
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
  // Initialize with snacks array (convert legacy single snack to array)
  const [localDays, setLocalDays] = useState<DailyPlan[]>(() =>
    plan.days.map(day => ({
      ...day,
      snacks: day.snacks || (day.snack ? [day.snack] : [])
    }))
  );
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
  const [editingMeal, setEditingMeal] = useState<{day: number, type: string, title: string, prepNotes: string} | null>(null);
  const [addingSnack, setAddingSnack] = useState<number | null>(null);

  const handleSaveEdit = () => {
    if (!editingMeal) return;
    setLocalDays(prev => prev.map(day => {
      if (day.day === editingMeal.day) {
        const mealType = editingMeal.type as keyof DailyPlan;
        return {
          ...day,
          [mealType]: { title: editingMeal.title, prepNotes: editingMeal.prepNotes }
        };
      }
      return day;
    }));
    setEditingMeal(null);
    setSelectedMealDetail(null);
  };

  const handleAddSnack = (dayNum: number, snackTitle: string, snackNotes: string, prepTime?: string, cookTime?: string) => {
    setLocalDays(prev => prev.map(day => {
      if (day.day === dayNum) {
        const newSnack: Meal = {
          title: snackTitle,
          prepNotes: snackNotes,
          prepTime: prepTime || '5 mins',
          cookTime: cookTime || '0 mins'
        };
        return {
          ...day,
          snacks: [...(day.snacks || []), newSnack]
        };
      }
      return day;
    }));
    setAddingSnack(null);
  };

  const handleRemoveSnack = (dayNum: number, snackIndex: number) => {
    setLocalDays(prev => prev.map(day => {
      if (day.day === dayNum) {
        const updatedSnacks = [...(day.snacks || [])];
        updatedSnacks.splice(snackIndex, 1);
        return {
          ...day,
          snacks: updatedSnacks
        };
      }
      return day;
    }));
    setSelectedMealDetail(null);
  };

  const suggestedSnacks = [
    { title: 'Apple Slices with Almond Butter', prepNotes: 'Slice apple and serve with a small dollop of almond butter.' },
    { title: 'Cheese Cubes', prepNotes: 'Cut cheese into small, easy-to-grab cubes.' },
    { title: 'Banana Bites', prepNotes: 'Slice banana into bite-sized pieces.' },
    { title: 'Yogurt with Berries', prepNotes: 'Mix plain yogurt with fresh berries.' },
    { title: 'Veggie Sticks', prepNotes: 'Cut cucumber and carrots into sticks.' },
    { title: 'Crackers with Hummus', prepNotes: 'Serve whole grain crackers with a side of hummus.' },
  ];

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
      <div className="flex items-center justify-between px-3 sm:px-6 py-2 sm:py-3 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={onReset} className="text-slate-500 text-xs sm:text-sm font-bold hover:text-brand-dark flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-all">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"/></svg>
            <span className="hidden sm:inline">Exit Plan</span>
          </button>
          <div className="h-6 w-px bg-gray-100 hidden sm:block"></div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('today')}
              className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'today' ? 'bg-white shadow-sm text-brand-dark' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Today
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white shadow-sm text-brand-dark' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <span className="hidden sm:inline">Weekly View</span>
              <span className="sm:hidden">Week</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={() => {
              const doc = new jsPDF();
              const pageWidth = doc.internal.pageSize.getWidth();

              // Loop through all 4 weeks
              for (let week = 1; week <= 4; week++) {
                const weekDays = localDays.filter(d => Math.ceil(d.day / 7) === week);
                const weekData = plan.weeks.find(w => w.week === week);

                // Add new page for weeks 2-4
                if (week > 1) {
                  doc.addPage();
                }

                let y = 20;

                // Header
                doc.setFontSize(24);
                doc.setTextColor(26, 31, 43);
                doc.text('3MEALS', pageWidth / 2, y, { align: 'center' });
                y += 10;

                doc.setFontSize(14);
                doc.setTextColor(100, 100, 100);
                doc.text(`Your ${userPrefs.age} old's Meal Plan`, pageWidth / 2, y, { align: 'center' });
                y += 8;

                doc.setFontSize(12);
                doc.text(`Week ${week} of 4`, pageWidth / 2, y, { align: 'center' });
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
                weekDays.forEach((day) => {
                  if (y > 250) {
                    doc.addPage();
                    y = 20;
                  }

                  doc.setFontSize(14);
                  doc.setTextColor(26, 31, 43);
                  doc.text(`Day ${day.day}`, 20, y);
                  y += 8;

                  const meals: { label: string, meal: Meal, color: [number, number, number] }[] = [
                    { label: 'Breakfast', meal: day.breakfast, color: [245, 158, 11] },
                    { label: 'Lunch', meal: day.lunch, color: [59, 130, 246] },
                    { label: 'Dinner', meal: day.dinner, color: [244, 63, 94] },
                  ];

                  // Add all snacks
                  (day.snacks || []).forEach((snack, idx) => {
                    const label = (day.snacks || []).length > 1 ? `Snack ${idx + 1}` : 'Snack';
                    meals.push({ label, meal: snack, color: [34, 197, 94] });
                  });

                  meals.forEach(({ label, meal, color }) => {
                    doc.setFontSize(10);
                    doc.setTextColor(color[0], color[1], color[2]);
                    doc.text(label + ':', 25, y);
                    doc.setTextColor(60, 60, 60);
                    doc.text(meal.title, 50, y);
                    // Add prep/cook times if available
                    if (meal.prepTime || meal.cookTime) {
                      const timeText = [
                        meal.prepTime ? `Prep: ${meal.prepTime}` : '',
                        meal.cookTime ? `Cook: ${meal.cookTime}` : ''
                      ].filter(Boolean).join(' | ');
                      doc.setFontSize(8);
                      doc.setTextColor(150, 150, 150);
                      doc.text(timeText, pageWidth - 20, y, { align: 'right' });
                    }
                    y += 5;
                    doc.setFontSize(9);
                    doc.setTextColor(120, 120, 120);
                    const prepLines = doc.splitTextToSize(meal.prepNotes, pageWidth - 60);
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
                  doc.text(`Grocery List - Week ${week}`, 20, y);
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
              }

              // Footer message on last page
              doc.addPage();
              let y = 100;
              doc.setFontSize(16);
              doc.setTextColor(26, 31, 43);
              doc.text('Your 30-Day Plan is Ready!', pageWidth / 2, y, { align: 'center' });
              y += 15;
              doc.setFontSize(11);
              doc.setTextColor(100, 100, 100);
              doc.text('Remember: fed is best. You\'re doing amazing!', pageWidth / 2, y, { align: 'center' });
              y += 10;
              doc.text('- The 3meals Team', pageWidth / 2, y, { align: 'center' });

              const today = new Date();
              const dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(/,/g, '').replace(/ /g, '-');
              doc.save(`3meals-plan-${dateStr}.pdf`);
            }}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-[#1A1F2B] text-white rounded-lg text-xs sm:text-sm font-bold shadow-lg hover:brightness-110 transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            <span className="hidden sm:inline">Download Full Plan</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - hidden on mobile */}
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
        <div className="flex-1 bg-white overflow-y-auto p-3 sm:p-4 md:p-8">
          <div className="max-w-6xl mx-auto">

            {viewMode === 'today' ? (
              /* Today's Focused View */
              <div className="max-w-xl mx-auto py-4 sm:py-8">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-serif-brand text-brand-dark">Today's Focus</h1>
                    <p className="text-slate-500 font-medium text-sm sm:text-base">Day {currentDay.day} of 30</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCurrentDayIndex(i => Math.max(0, i - 1))}
                      className="w-9 h-9 sm:w-10 sm:h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                      disabled={currentDayIndex === 0}
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setCurrentDayIndex(i => Math.min(localDays.length - 1, i + 1))}
                      className="w-9 h-9 sm:w-10 sm:h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                      disabled={currentDayIndex === localDays.length - 1}
                    >
                      →
                    </button>
                  </div>
                </div>

                <div className="space-y-4 sm:space-y-6">
                  <TodayMealCard type="Breakfast" meal={currentDay.breakfast} icon="🍳" color="bg-amber-50 text-amber-700 border-amber-100" onSwap={() => initiateSwap(currentDay.day, 'breakfast')} onEdit={() => setSelectedMealDetail({day: currentDay.day, type: 'breakfast', meal: currentDay.breakfast})} />
                  <TodayMealCard type="Lunch" meal={currentDay.lunch} icon="🥪" color="bg-blue-50 text-blue-700 border-blue-100" onSwap={() => initiateSwap(currentDay.day, 'lunch')} onEdit={() => setSelectedMealDetail({day: currentDay.day, type: 'lunch', meal: currentDay.lunch})} />
                  <TodayMealCard type="Dinner" meal={currentDay.dinner} icon="🍲" color="bg-rose-50 text-rose-700 border-rose-100" onSwap={() => initiateSwap(currentDay.day, 'dinner')} onEdit={() => setSelectedMealDetail({day: currentDay.day, type: 'dinner', meal: currentDay.dinner})} />
                  {showSnacks && (currentDay.snacks || []).map((snack, idx) => (
                    <TodayMealCard key={idx} type={`Snack ${(currentDay.snacks || []).length > 1 ? idx + 1 : ''}`} meal={snack} icon="🍎" color="bg-emerald-50 text-emerald-700 border-emerald-100" onSwap={() => initiateSwap(currentDay.day, 'snack')} onEdit={() => setSelectedMealDetail({day: currentDay.day, type: `snack-${idx}`, meal: snack})} />
                  ))}
                  {showSnacks && (
                    <button
                      onClick={() => setAddingSnack(currentDay.day)}
                      className="w-full py-4 border-2 border-dashed border-emerald-200 rounded-2xl text-emerald-500 font-bold hover:bg-emerald-50 hover:border-emerald-300 transition-all"
                    >
                      + Add Snack
                    </button>
                  )}
                </div>

                <div className="mt-8 sm:mt-12 p-4 sm:p-6 bg-[#2563EB] rounded-2xl text-white shadow-xl shadow-blue-200">
                  <h3 className="text-base sm:text-lg font-bold mb-2 sm:mb-3 flex items-center gap-2">
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
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b border-gray-100">
                  <div className="flex gap-1 sm:gap-2 flex-wrap">
                    {[1, 2, 3, 4].map(w => (
                      <button
                        key={w}
                        onClick={() => setSelectedWeek(w)}
                        className={`px-4 sm:px-6 py-2 rounded-full text-xs font-bold transition-all ${
                          selectedWeek === w
                            ? 'bg-brand-dark text-white'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-gray-50'
                        }`}
                      >
                        <span className="hidden sm:inline">Week </span>{w}
                      </button>
                    ))}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-serif-brand">Week {selectedWeek}</h2>
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
                        {showSnacks && (
                          <div className="pt-2 border-t border-dashed border-gray-100 space-y-1">
                            {(day.snacks || []).map((snack, idx) => (
                              <p
                                key={idx}
                                onClick={() => setSelectedMealDetail({day: day.day, type: `snack-${idx}`, meal: snack})}
                                className="text-[10px] font-medium text-slate-500 truncate cursor-pointer hover:text-emerald-600"
                              >
                                🍎 {snack.title}
                              </p>
                            ))}
                            <button
                              onClick={() => setAddingSnack(day.day)}
                              className="text-[10px] font-bold text-emerald-500 hover:text-emerald-600"
                            >
                              + Add Snack
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Grocery & Prep Sections */}
            <div className="mt-8 sm:mt-16 grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-12 border-t border-gray-100 pt-6 sm:pt-12">
              <div className="p-4 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
                  <span className="text-xl sm:text-2xl">🛒</span> Grocery List (Week {selectedWeek})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  {currentWeekData?.groceryList.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => toggleCheck(item)}
                      className="flex items-center gap-3 text-sm font-medium transition-all group text-left py-1"
                    >
                      <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-all flex-shrink-0 ${checkedItems[item] ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-200 group-hover:border-gray-300'}`}>
                        {checkedItems[item] && <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>}
                      </div>
                      <span className={`${checkedItems[item] ? 'text-slate-300 line-through' : 'text-slate-600'}`}>{item}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 sm:p-8 bg-[#FFF9E6] rounded-2xl sm:rounded-3xl border border-[#FFE7A3]">
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-brand-dark">
                  <span className="text-xl sm:text-2xl">💡</span> Batch Prep Strategist
                </h3>
                <div className="space-y-3 sm:space-y-4">
                  {currentWeekData?.batchPrepTips.map((tip, idx) => (
                    <div key={idx} className="flex gap-3 sm:gap-4 items-start">
                      <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-amber-700 shadow-sm">{idx + 1}</div>
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
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50 sticky top-0">
              <div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Day {selectedMealDetail.day} • {selectedMealDetail.type}</p>
                <h3 className="text-xl sm:text-2xl font-serif-brand text-brand-dark mt-1">{selectedMealDetail.meal.title}</h3>
              </div>
              <button onClick={() => setSelectedMealDetail(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors">✕</button>
            </div>

            <div className="p-4 sm:p-8">
              {editingMeal ? (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Meal Name</label>
                    <input
                      type="text"
                      value={editingMeal.title}
                      onChange={(e) => setEditingMeal({...editingMeal, title: e.target.value})}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#1A1F2B] outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Prep Notes</label>
                    <textarea
                      value={editingMeal.prepNotes}
                      onChange={(e) => setEditingMeal({...editingMeal, prepNotes: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#1A1F2B] outline-none font-medium resize-none"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={handleSaveEdit} className="flex-1 py-3 px-4 bg-[#1A1F2B] text-white rounded-xl font-bold hover:brightness-110 transition-all">
                      Save Changes
                    </button>
                    <button onClick={() => setEditingMeal(null)} className="flex-1 py-3 px-4 border-2 border-gray-200 text-slate-600 rounded-xl font-bold hover:border-gray-300 transition-all">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {(selectedMealDetail.meal.prepTime || selectedMealDetail.meal.cookTime) && (
                    <div className="flex gap-4 mb-4 p-3 bg-gray-50 rounded-xl">
                      {selectedMealDetail.meal.prepTime && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔪</span>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Prep</p>
                            <p className="text-sm font-bold text-slate-700">{selectedMealDetail.meal.prepTime}</p>
                          </div>
                        </div>
                      )}
                      {selectedMealDetail.meal.cookTime && (
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🍳</span>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">Cook</p>
                            <p className="text-sm font-bold text-slate-700">{selectedMealDetail.meal.cookTime}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mb-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Prep Notes</h4>
                    <p className="text-slate-600 leading-relaxed">{selectedMealDetail.meal.prepNotes}</p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setEditingMeal({
                        day: selectedMealDetail.day,
                        type: selectedMealDetail.type,
                        title: selectedMealDetail.meal.title,
                        prepNotes: selectedMealDetail.meal.prepNotes
                      })}
                      className="flex-1 py-3 px-4 bg-[#1A1F2B] text-white rounded-xl font-bold hover:brightness-110 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        const type = selectedMealDetail.type as 'breakfast' | 'lunch' | 'dinner' | 'snack';
                        initiateSwap(selectedMealDetail.day, type);
                        setSelectedMealDetail(null);
                      }}
                      className="flex-1 py-3 px-4 border-2 border-gray-200 text-slate-600 rounded-xl font-bold hover:border-gray-300 transition-all"
                    >
                      Swap
                    </button>
                    {selectedMealDetail.type.startsWith('snack-') && (
                      <button
                        onClick={() => {
                          const snackIndex = parseInt(selectedMealDetail.type.split('-')[1], 10);
                          handleRemoveSnack(selectedMealDetail.day, snackIndex);
                        }}
                        className="py-3 px-4 border-2 border-red-200 text-red-500 rounded-xl font-bold hover:bg-red-50 hover:border-red-300 transition-all"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {swappingTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 max-h-[90vh]">
            <div className="p-4 sm:p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50 sticky top-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-serif-brand text-brand-dark">Swap {swappingTarget.type}</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Day {swappingTarget.day}</p>
              </div>
              <button onClick={() => setSwappingTarget(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors">✕</button>
            </div>

            <div className="p-4 sm:p-8 space-y-4 max-h-[60vh] overflow-y-auto">
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

      {/* Add Snack Modal */}
      {addingSnack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 max-h-[90vh]">
            <div className="p-4 sm:p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50 sticky top-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-serif-brand text-brand-dark">Add Snack</h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Day {addingSnack}</p>
              </div>
              <button onClick={() => setAddingSnack(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors">✕</button>
            </div>

            <div className="p-4 sm:p-8 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-500 font-medium mb-4">Pick a suggested snack or add your own:</p>
              {suggestedSnacks.map((snack, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddSnack(addingSnack, snack.title, snack.prepNotes)}
                  className="w-full text-left p-4 rounded-2xl border-2 border-gray-50 hover:border-emerald-400 hover:bg-emerald-50 transition-all group"
                >
                  <h4 className="font-bold text-brand-dark group-hover:text-emerald-600 mb-1">{snack.title}</h4>
                  <p className="text-xs text-slate-500 italic">{snack.prepNotes}</p>
                </button>
              ))}
              <div className="border-t border-gray-100 pt-4 mt-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Or add your own:</p>
                <input
                  type="text"
                  placeholder="Snack name..."
                  id="custom-snack-title"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none font-medium mb-2"
                />
                <input
                  type="text"
                  placeholder="Prep notes..."
                  id="custom-snack-notes"
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-emerald-400 outline-none font-medium mb-3"
                />
                <button
                  onClick={() => {
                    const titleEl = document.getElementById('custom-snack-title') as HTMLInputElement;
                    const notesEl = document.getElementById('custom-snack-notes') as HTMLInputElement;
                    if (titleEl?.value) {
                      handleAddSnack(addingSnack, titleEl.value, notesEl?.value || '');
                    }
                  }}
                  className="w-full py-3 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all"
                >
                  Add Custom Snack
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const TodayMealCard: React.FC<{ type: string, meal: Meal, icon: string, color: string, onSwap: () => void, onEdit: () => void }> = ({ type, meal, icon, color, onSwap, onEdit }) => (
  <div
    onClick={onEdit}
    className="bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-6 shadow-sm hover:shadow-md transition-all group relative overflow-hidden cursor-pointer"
  >
    <div className="flex items-start justify-between mb-3 sm:mb-4">
      <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg ${color} flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-black uppercase tracking-widest`}>
        <span>{icon}</span>
        {type}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onSwap(); }}
        className="text-slate-300 hover:text-brand-dark transition-colors p-1"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      </button>
    </div>
    <h3 className="text-lg sm:text-xl font-bold text-brand-dark mb-2 group-hover:text-[#2563EB] transition-colors">{meal.title}</h3>
    {(meal.prepTime || meal.cookTime) && (
      <div className="flex gap-3 mb-2 text-xs font-medium">
        {meal.prepTime && <span className="text-slate-400">Prep: {meal.prepTime}</span>}
        {meal.cookTime && <span className="text-slate-400">Cook: {meal.cookTime}</span>}
      </div>
    )}
    <p className="text-sm text-slate-500 leading-relaxed font-medium italic line-clamp-2 sm:line-clamp-none">
      {meal.prepNotes}
    </p>
    <p className="text-xs text-slate-400 mt-2 sm:mt-3 group-hover:text-slate-500">Tap to edit</p>
  </div>
);

const CalendarMeal: React.FC<{ type: string, meal: Meal, color: string, onClick: () => void }> = ({ type, meal, color, onClick }) => (
  <div onClick={onClick} className="cursor-pointer group">
    <div className="flex items-center gap-2 mb-1">
      <span className={`text-[10px] font-black w-4 flex-shrink-0 ${color}`}>{type}</span>
      <h4 className="text-[11px] font-bold text-slate-800 group-hover:text-[#2563EB] truncate transition-colors">{meal.title}</h4>
    </div>
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
