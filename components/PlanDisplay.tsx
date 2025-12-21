
import React, { useState, useEffect } from 'react';
import { FullMealPlan, DailyPlan, WeeklyData, Meal, UserPreferences } from '../types';
import { getMealAlternatives } from '../services/geminiService';
import { jsPDF } from 'jspdf';

interface PlanDisplayProps {
  plan: FullMealPlan;
  onReset: () => void;
  userPrefs: UserPreferences;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({ plan, onReset, userPrefs }) => {
  const isSurviving = userPrefs.cookingSituation === 'surviving';
  const [viewMode, setViewMode] = useState<'today' | 'calendar'>(isSurviving ? 'today' : 'calendar');
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [localDays, setLocalDays] = useState<DailyPlan[]>(plan.days);
  const [showSnacks, setShowSnacks] = useState(true);
  const [isShuffling, setIsShuffling] = useState(false);
  
  // Track current day for "Today" view (defaulting to Day 1)
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  
  // Persistence for grocery list
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  const [swappingTarget, setSwappingTarget] = useState<{day: number, type: 'breakfast' | 'lunch' | 'dinner' | 'snack'} | null>(null);
  const [alternatives, setAlternatives] = useState<Meal[]>([]);
  const [isLoadingAlternatives, setIsLoadingAlternatives] = useState(false);
  const [selectedMealDetail, setSelectedMealDetail] = useState<{day: number, type: string, meal: Meal} | null>(null);

  useEffect(() => {
    setLocalDays(plan.days);
  }, [plan]);

  const toggleCheck = (item: string) => {
    setCheckedItems(prev => ({ ...prev, [item]: !prev[item] }));
  };

  const shuffleSchedule = () => {
    setIsShuffling(true);
    setTimeout(() => {
      const shuffled = [...localDays].sort(() => Math.random() - 0.5);
      const reindexed = shuffled.map((day, index) => ({
        ...day,
        day: index + 1
      }));
      setLocalDays(reindexed);
      setIsShuffling(false);
    }, 600);
  };

  const initiateSwap = async (day: number, type: 'breakfast' | 'lunch' | 'dinner' | 'snack') => {
    const currentDay = localDays.find(d => d.day === day);
    if (!currentDay) return;
    
    const currentMeal = currentDay[type] as Meal;
    setSwappingTarget({ day, type });
    setAlternatives([]);
    setIsLoadingAlternatives(true);
    
    try {
      const existingTitles = localDays.flatMap(d => [d.breakfast.title, d.lunch.title, d.dinner.title]);
      const alts = await getMealAlternatives(userPrefs, type, currentMeal, existingTitles);
      setAlternatives(alts);
    } catch (err) {
      console.error("Failed to fetch alternatives", err);
    } finally {
      setIsLoadingAlternatives(false);
    }
  };

  const applySwap = (newMeal: Meal) => {
    if (!swappingTarget) return;
    setLocalDays(prev => prev.map(d => {
      if (d.day === swappingTarget.day) {
        return { ...d, [swappingTarget.type]: newMeal };
      }
      return d;
    }));
    setSwappingTarget(null);
  };

  const currentDay = localDays[currentDayIndex];
  const filteredDays = localDays.filter(d => Math.ceil(d.day / 7) === selectedWeek);
  const currentWeekData = plan.weeks.find(w => w.week === selectedWeek);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top Navbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="text-slate-500 text-sm font-bold hover:text-brand-dark flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
            Exit Plan
          </button>
          <div className="h-6 w-px bg-gray-100"></div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button 
              onClick={() => setViewMode('today')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'today' ? 'bg-white shadow-sm text-brand-dark' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Today
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-brand-dark' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Month View
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const weekDays = localDays.filter(d => Math.ceil(d.day / 7) === selectedWeek);
              const weekData = plan.weeks.find(w => w.week === selectedWeek);

              const doc = new jsPDF();
              const pageWidth = doc.internal.pageSize.getWidth();
              let y = 20;

              // Header
              doc.setFontSize(24);
              doc.setTextColor(26, 31, 43);
              doc.text('YUMLI', pageWidth / 2, y, { align: 'center' });
              y += 10;

              doc.setFontSize(14);
              doc.setTextColor(100, 100, 100);
              doc.text(`Your ${userPrefs.age} old's Meal Plan`, pageWidth / 2, y, { align: 'center' });
              y += 8;

              doc.setFontSize(12);
              doc.text(`Week ${selectedWeek} of 4`, pageWidth / 2, y, { align: 'center' });
              y += 10;

              doc.setFontSize(11);
              doc.setTextColor(245, 158, 11);
              doc.text(`"You've got this!"`, pageWidth / 2, y, { align: 'center' });
              y += 15;

              // Divider
              doc.setDrawColor(230, 230, 230);
              doc.line(20, y, pageWidth - 20, y);
              y += 15;

              // Daily meals
              weekDays.forEach((day, idx) => {
                if (y > 250) {
                  doc.addPage();
                  y = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(26, 31, 43);
                doc.text(`Day ${day.day}`, 20, y);
                y += 8;

                const meals = [
                  { label: 'Breakfast', meal: day.breakfast, color: [245, 158, 11] },
                  { label: 'Lunch', meal: day.lunch, color: [59, 130, 246] },
                  { label: 'Dinner', meal: day.dinner, color: [244, 63, 94] },
                ];

                if (day.snack) {
                  meals.push({ label: 'Snack', meal: day.snack, color: [34, 197, 94] });
                }

                meals.forEach(({ label, meal, color }) => {
                  doc.setFontSize(10);
                  doc.setTextColor(color[0], color[1], color[2]);
                  doc.text(label + ':', 25, y);
                  doc.setTextColor(60, 60, 60);
                  doc.text(meal.title, 50, y);
                  y += 5;
                  doc.setFontSize(9);
                  doc.setTextColor(120, 120, 120);
                  const prepLines = doc.splitTextToSize(`> ${meal.prepNotes}`, pageWidth - 60);
                  doc.text(prepLines, 30, y);
                  y += prepLines.length * 4 + 3;
                });

                y += 8;
              });

              // Grocery List
              if (weekData) {
                if (y > 200) {
                  doc.addPage();
                  y = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(26, 31, 43);
                doc.text(`Grocery List - Week ${selectedWeek}`, 20, y);
                y += 10;

                doc.setFontSize(10);
                doc.setTextColor(60, 60, 60);
                weekData.groceryList.forEach(item => {
                  if (y > 270) {
                    doc.addPage();
                    y = 20;
                  }
                  doc.text(`[ ]  ${item}`, 25, y);
                  y += 6;
                });

                y += 10;

                // Batch Prep Tips
                if (y > 230) {
                  doc.addPage();
                  y = 20;
                }

                doc.setFontSize(14);
                doc.setTextColor(26, 31, 43);
                doc.text('Batch Prep Tips', 20, y);
                y += 10;

                doc.setFontSize(10);
                doc.setTextColor(60, 60, 60);
                weekData.batchPrepTips.forEach((tip, i) => {
                  if (y > 270) {
                    doc.addPage();
                    y = 20;
                  }
                  const tipLines = doc.splitTextToSize(`${i + 1}. ${tip}`, pageWidth - 50);
                  doc.text(tipLines, 25, y);
                  y += tipLines.length * 5 + 3;
                });
              }

              // Footer message
              if (y > 260) {
                doc.addPage();
                y = 20;
              }
              y += 10;
              doc.setFontSize(11);
              doc.setTextColor(100, 100, 100);
              doc.text('Remember: fed is best. You\'re doing amazing!', pageWidth / 2, y, { align: 'center' });

              doc.save(`yumli-week-${selectedWeek}-meal-plan.pdf`);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2B] text-white rounded-lg text-sm font-bold shadow-lg hover:brightness-110 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Download PDF
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-gray-100 bg-white overflow-y-auto flex flex-col p-6 gap-8 hidden lg:flex">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[#FFF9E6] rounded-2xl flex items-center justify-center text-3xl shadow-inner border border-[#FFE7A3]">👶</div>
            <h2 className="text-3xl font-serif-brand leading-tight">Your {userPrefs.age} old's Plan</h2>
            <p className="text-slate-500 font-medium text-sm italic leading-relaxed">"Let's find the best month of eating yet."</p>
          </div>

          <div className="space-y-3">
            <button 
              onClick={shuffleSchedule}
              disabled={isShuffling}
              className="w-full border-2 border-primary-yellow bg-primary-yellow/10 py-3.5 rounded-lg font-bold text-sm hover:bg-primary-yellow/20 transition-all flex items-center justify-center gap-2"
            >
              <span className="text-lg">🎲</span> {isShuffling ? 'Shuffling...' : 'Shuffle Schedule'}
            </button>
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-50">
            <SidebarItem icon="🍲" label="Eating Style" value={userPrefs.eatingStyle} />
            <SidebarItem icon="⏳" label="Prep Strategy" value={userPrefs.cookingSituation} />
          </div>

          <div className="mt-auto pt-6">
            </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            
            {viewMode === 'today' ? (
              /* Today's Focused View */
              <div className="max-w-xl mx-auto py-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h1 className="text-4xl font-serif-brand text-brand-dark">Today's Focus</h1>
                    <p className="text-slate-500 font-medium">Day {currentDay.day} of 30</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))}
                      className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                      disabled={currentDayIndex === 0}
                    >
                      ←
                    </button>
                    <button 
                      onClick={() => setCurrentDayIndex(i => Math.min(localDays.length - 1, i + 1))}
                      className="w-10 h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                      disabled={currentDayIndex === localDays.length - 1}
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="space-y-6">
                  <TodayMealCard type="Breakfast" meal={currentDay.breakfast} icon="🍳" color="bg-amber-50 text-amber-700 border-amber-100" onSwap={() => initiateSwap(currentDay.day, 'breakfast')} />
                  <TodayMealCard type="Lunch" meal={currentDay.lunch} icon="🥪" color="bg-blue-50 text-blue-700 border-blue-100" onSwap={() => initiateSwap(currentDay.day, 'lunch')} />
                  <TodayMealCard type="Dinner" meal={currentDay.dinner} icon="🍲" color="bg-rose-50 text-rose-700 border-rose-100" onSwap={() => initiateSwap(currentDay.day, 'dinner')} />
                  {showSnacks && currentDay.snack && (
                    <TodayMealCard type="Snack" meal={currentDay.snack} icon="🍎" color="bg-emerald-50 text-emerald-700 border-emerald-100" onSwap={() => initiateSwap(currentDay.day, 'snack')} />
                  )}
                </div>

                <div className="mt-12 p-6 bg-[#2563EB] rounded-2xl text-white shadow-xl shadow-blue-200">
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                    <span>⚡️</span> Quick Prep Strategy
                  </h3>
                  <p className="text-blue-50 text-sm leading-relaxed italic">
                    {currentDay.dinner.prepNotes.length > 5 ? currentDay.dinner.prepNotes : "Steam the veggies while you prepare breakfast to save 15 minutes tonight."}
                  </p>
                </div>
              </div>
            ) : (
              /* Month/Calendar View */
              <>
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                  <div className="flex gap-2">
                    {[1, 2, 3, 4].map(w => (
                      <button
                        key={w}
                        onClick={() => setSelectedWeek(w)}
                        className={`px-6 py-2 rounded-full text-xs font-bold transition-all ${
                          selectedWeek === w 
                            ? 'bg-brand-dark text-white' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-gray-50'
                        }`}
                      >
                        Week {w}
                      </button>
                    ))}
                  </div>
                  <h2 className="text-2xl font-serif-brand">Week {selectedWeek} Schedule</h2>
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4 transition-opacity duration-300 ${isShuffling ? 'opacity-40' : 'opacity-100'}`}>
                  {filteredDays.map((day) => (
                    <div key={day.day} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
                        <span className="text-sm font-black text-slate-800">Day {day.day}</span>
                        <div className="flex gap-1">
                           <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                           <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                           <div className="w-2 h-2 rounded-full bg-rose-400"></div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <CalendarMeal type="B" meal={day.breakfast} color="text-amber-600" onClick={() => setSelectedMealDetail({day: day.day, type: 'breakfast', meal: day.breakfast})} />
                        <CalendarMeal type="L" meal={day.lunch} color="text-blue-600" onClick={() => setSelectedMealDetail({day: day.day, type: 'lunch', meal: day.lunch})} />
                        <CalendarMeal type="D" meal={day.dinner} color="text-rose-600" onClick={() => setSelectedMealDetail({day: day.day, type: 'dinner', meal: day.dinner})} />
                        {showSnacks && day.snack && (
                          <div className="pt-2 border-t border-dashed border-gray-100">
                             <p className="text-[10px] font-medium text-slate-500 truncate">{day.snack.title}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grocery & Prep Sections */}
            <div className="mt-16 grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-gray-100 pt-12">
              <div className="p-8 bg-white rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-2xl">🛒</span> Grocery List (Week {selectedWeek})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {currentWeekData?.groceryList.map((item, idx) => (
                    <button 
                      key={idx} 
                      onClick={() => toggleCheck(item)}
                      className="flex items-center gap-3 text-sm font-medium transition-all group text-left"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all ${checkedItems[item] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 group-hover:border-gray-300'}`}>
                        {checkedItems[item] && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>}
                      </div>
                      <span className={`${checkedItems[item] ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{item}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-[#FFF9E6] rounded-3xl border border-[#FFE7A3]">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-brand-dark">
                  <span className="text-2xl">💡</span> Batch Prep Strategist
                </h3>
                <div className="space-y-4">
                  {currentWeekData?.batchPrepTips.map((tip, idx) => (
                    <div key={idx} className="flex gap-4 items-start">
                      <div className="w-6 h-6 rounded-full bg-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-amber-700 shadow-sm">{idx + 1}</div>
                      <p className="text-sm text-[#7A5C00] font-bold leading-relaxed">
                        {tip}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alternative Swap Modal */}
      {/* Meal Detail Modal */}
      {selectedMealDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Day {selectedMealDetail.day} • {selectedMealDetail.type}</p>
                <h3 className="text-2xl font-serif-brand text-brand-dark mt-1">{selectedMealDetail.meal.title}</h3>
              </div>
              <button onClick={() => setSelectedMealDetail(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors">✕</button>
            </div>

            <div className="p-8">
              <div className="mb-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Prep Notes</h4>
                <p className="text-slate-600 leading-relaxed">{selectedMealDetail.meal.prepNotes}</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    const type = selectedMealDetail.type as 'breakfast' | 'lunch' | 'dinner' | 'snack';
                    initiateSwap(selectedMealDetail.day, type);
                    setSelectedMealDetail(null);
                  }}
                  className="flex-1 py-3 px-4 bg-[#1A1F2B] text-white rounded-xl font-bold hover:brightness-110 transition-all"
                >
                  Swap Meal
                </button>
                <button
                  onClick={() => setSelectedMealDetail(null)}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 text-slate-600 rounded-xl font-bold hover:border-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {swappingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-serif-brand text-brand-dark">Swap {swappingTarget.type}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Day {swappingTarget.day}</p>
              </div>
              <button onClick={() => setSwappingTarget(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors">✕</button>
            </div>
            
            <div className="p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              {isLoadingAlternatives ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 border-4 border-brand-dark border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                  <p className="text-slate-500 font-bold italic">Cooking up some new ideas...</p>
                </div>
              ) : (
                <>
                  {alternatives.map((alt, idx) => (
                    <button
                      key={idx}
                      onClick={() => applySwap(alt)}
                      className="w-full text-left p-5 rounded-2xl border-2 border-gray-50 hover:border-brand-dark hover:bg-gray-50 transition-all group"
                    >
                      <h4 className="font-bold text-brand-dark group-hover:text-[#2563EB] mb-2">{alt.title}</h4>
                      <p className="text-xs text-slate-500 italic leading-relaxed">{alt.prepNotes}</p>
                    </button>
                  ))}
                  <button onClick={() => setSwappingTarget(null)} className="w-full py-4 text-slate-400 font-bold hover:text-slate-600 transition-colors">
                    Keep Original
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TodayMealCard: React.FC<{ type: string, meal: Meal, icon: string, color: string, onSwap: () => void }> = ({ type, meal, icon, color, onSwap }) => (
  <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
    <div className="flex items-start justify-between mb-4">
      <div className={`px-3 py-1.5 rounded-lg ${color} flex items-center gap-2 text-xs font-black uppercase tracking-widest`}>
        <span>{icon}</span>
        {type}
      </div>
      <button onClick={onSwap} className="text-slate-300 hover:text-brand-dark transition-colors">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      </button>
    </div>
    <h3 className="text-xl font-bold text-brand-dark mb-2">{meal.title}</h3>
    <p className="text-sm text-slate-500 leading-relaxed font-medium italic">
      {meal.prepNotes}
    </p>
  </div>
);

const CalendarMeal: React.FC<{ type: string, meal: Meal, color: string, onClick: () => void }> = ({ type, meal, color, onClick }) => (
  <div onClick={onClick} className="cursor-pointer group">
    <div className="flex items-center gap-2 mb-1">
      <span className={`text-[10px] font-black w-4 flex-shrink-0 ${color}`}>{type}</span>
      <h4 className="text-[11px] font-bold text-slate-800 group-hover:text-[#2563EB] truncate transition-colors">{meal.title}</h4>
    </div>
    {/* Prep notes only shown briefly/truncated in calendar to reduce density */}
    <p className="text-[9px] text-slate-400 pl-6 leading-tight truncate group-hover:text-slate-600">
      {meal.prepNotes}
    </p>
  </div>
);

const SidebarItem: React.FC<{ icon: string, label: string, value: string, badge?: boolean }> = ({ icon, label, value, badge }) => (
  <div className="flex items-start gap-4">
    <div className="text-lg mt-0.5">{icon}</div>
    <div>
      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <div className="flex items-center gap-2 mt-0.5">
        <p className="text-sm font-bold text-brand-dark capitalize">{value}</p>
        {badge && (
          <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
        )}
      </div>
    </div>
  </div>
);

export default PlanDisplay;
