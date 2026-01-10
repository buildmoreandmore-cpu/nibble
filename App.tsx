
import React, { useState, useEffect } from 'react';
import { UserPreferences, FullMealPlan, EatingStyle, CookingSituation } from './types';
import { generateMealPlan } from './services/geminiService';
import PlanDisplay from './components/PlanDisplay';

const LOADING_STAGES = [
  "Gathering age-appropriate recipes...",
  "Balancing textures and nutrients...",
  "Applying your dietary filters...",
  "Polishing 30 days of dinner plans...",
  "Finalizing your automatic grocery list..."
];

const AFFIRMATIONS = [
  "You're doing great. Seriously.",
  "Did you know? Toddlers often need 15+ tries before liking a new food.",
  "Deep breaths. We've got the mental load from here.",
  "Picky eating is a normal developmental phase (even if it's exhausting).",
  "Homemade or store-bought, fed is best."
];

const App: React.FC = () => {
  // Load saved data from localStorage on initial render
  const loadSavedData = () => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('3meals_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  const savedData = loadSavedData();

  const [step, setStep] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [affirmationIdx, setAffirmationIdx] = useState(0);
  const [mealPlan, setMealPlan] = useState<FullMealPlan | null>(savedData?.mealPlan || null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(savedData?.email || '');
  const [emailCaptured, setEmailCaptured] = useState<boolean>(savedData?.emailCaptured || false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [showReturningUserModal, setShowReturningUserModal] = useState<boolean>(false);
  const [isLoadingPlan, setIsLoadingPlan] = useState<boolean>(false);

  const [prefs, setPrefs] = useState<UserPreferences>(savedData?.prefs || {
    age: '',
    eatingStyle: 'mixed',
    favorites: '',
    wantsMoreOf: '',
    allergies: '',
    hatesGags: '',
    cookingSituation: 'mixed',
    dietaryPreferences: ''
  });

  // Save to localStorage whenever meal plan or email state changes
  useEffect(() => {
    if (mealPlan || emailCaptured) {
      localStorage.setItem('3meals_session', JSON.stringify({
        mealPlan,
        email,
        emailCaptured,
        prefs
      }));
    }
  }, [mealPlan, email, emailCaptured, prefs]);

  // Handle loading screen rotations
  useEffect(() => {
    let stageInterval: number;
    let affInterval: number;
    
    if (isLoading) {
      stageInterval = window.setInterval(() => {
        setLoadingStage(prev => (prev + 1) % LOADING_STAGES.length);
      }, 3000);
      
      affInterval = window.setInterval(() => {
        setAffirmationIdx(prev => (prev + 1) % AFFIRMATIONS.length);
      }, 5000);
    }
    
    return () => {
      clearInterval(stageInterval);
      clearInterval(affInterval);
    };
  }, [isLoading]);

  const handleNext = () => setStep(s => s + 1);
  const handlePrev = () => setStep(s => s - 1);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    // Save email with meal plan and prefs to database
    try {
      await fetch('/api/save-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, mealPlan, prefs }),
      });
    } catch (err) {
      console.error('Failed to save email:', err);
    }

    setEmailCaptured(true);
  };

  const handleReturningUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoadingPlan(true);

    try {
      const response = await fetch('/api/get-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (data.exists && data.mealPlan) {
        setMealPlan(data.mealPlan);
        setPrefs(data.prefs);
        setEmailCaptured(true);
        setShowReturningUserModal(false);
      } else {
        setEmailError('No plan found for this email. Try creating a new one!');
      }
    } catch (err) {
      console.error('Failed to fetch plan:', err);
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setIsLoadingPlan(false);
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const plan = await generateMealPlan(prefs);
      setMealPlan(plan);
    } catch (err: any) {
      console.error('Meal plan generation error:', err);
      const errorMessage = err?.message || err?.toString() || "Unknown error";
      setError(`Oof, something went wrong: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (field: keyof UserPreferences, item: string) => {
    if (item === 'None') {
      setPrefs({ ...prefs, [field]: '' });
      return;
    }

    const current = prefs[field] as string;
    const items = current ? current.split(',').map(i => i.trim()).filter(Boolean) : [];
    
    if (items.includes(item)) {
      setPrefs({ ...prefs, [field]: items.filter(i => i !== item).join(', ') });
    } else {
      setPrefs({ ...prefs, [field]: items.length > 0 ? `${current}, ${item}` : item });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white overflow-hidden">
        <div className="relative w-32 h-32 mb-12">
          <div className="absolute inset-0 border-[4px] border-slate-50 rounded-full"></div>
          <div className="absolute inset-0 border-[4px] border-[#FFD200] rounded-full border-t-transparent animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <img src="/logo.png" alt="3meals" className="w-16 h-16 object-contain" />
          </div>
        </div>
        
        <div className="text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
          <h2 className="text-4xl font-serif-brand text-brand-dark mb-6 italic transition-all duration-500">
            {LOADING_STAGES[loadingStage]}
          </h2>
          
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-2xl mb-8 transform transition-all">
            <p className="text-emerald-800 font-medium italic">
              "{AFFIRMATIONS[affirmationIdx]}"
            </p>
          </div>

          <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
            Takes about 15 seconds • Usually eatable
          </p>
        </div>
      </div>
    );
  }

  if (mealPlan && !emailCaptured) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8 bg-white">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
            </svg>
          </div>

          <h1 className="text-4xl md:text-5xl font-serif-brand text-brand-dark mb-4">
            Your plan is ready!
          </h1>

          <p className="text-lg text-slate-500 mb-10 font-medium">
            Enter your email to view your 30-day meal plan and get your weekly grocery lists.
          </p>

          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <input
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full px-6 py-4 rounded-xl border-2 text-lg font-medium outline-none transition-all ${
                  emailError
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-gray-200 focus:border-brand-dark'
                }`}
              />
              {emailError && (
                <p className="text-red-500 text-sm font-medium mt-2 text-left">{emailError}</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-[#2563EB] text-white py-4 rounded-xl font-bold text-lg hover:brightness-110 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              See My Plan
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-400 font-medium">
            You can download a printable PDF of your plan inside.
          </p>
        </div>
      </div>
    );
  }

  if (mealPlan && emailCaptured) {
    return <PlanDisplay plan={mealPlan} userPrefs={prefs} onReset={() => {
      setMealPlan(null);
      setEmailCaptured(false);
      setEmail('');
      localStorage.removeItem('3meals_session');
    }} />;
  }

  const FormHeader = () => (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 mb-6 sm:mb-12">
      <div
        onClick={() => setStep(0)}
        className="flex items-center gap-2 sm:gap-3 cursor-pointer hover:opacity-70 transition-opacity"
      >
        <img src="/logo.png" alt="3meals" className="w-7 h-7 sm:w-8 sm:h-8 object-contain" />
        <span className="font-display font-bold text-base sm:text-lg tracking-tight">3meals</span>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-12 sm:w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-slate-400 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }}></div>
        </div>
      </div>
    </div>
  );

  if (step === 0) {
    return (
      <div className="min-h-screen bg-white relative overflow-hidden">
        {/* Background logo watermark - large "3" */}
        <div className="absolute top-1/2 right-0 lg:right-[10%] -translate-y-1/2 opacity-[0.12] pointer-events-none">
          <img src="/logo.png" alt="" className="w-[400px] h-[400px] sm:w-[500px] sm:h-[500px] md:w-[700px] md:h-[700px] lg:w-[900px] lg:h-[900px] object-contain" />
        </div>

        <nav className="flex items-center justify-between px-4 sm:px-8 py-4 sm:py-6 max-w-7xl mx-auto relative z-10">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="3meals" className="w-8 h-8 object-contain" />
            <span className="font-display font-bold text-lg sm:text-xl">3meals</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleNext}
              className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-full font-bold text-sm border-2 border-brand-dark hover:bg-brand-dark hover:text-white transition-all"
            >
              Get Started
            </button>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 sm:pt-16 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center relative z-10">
          <div className="text-left">
            <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif-brand leading-[0.95] text-brand-dark mb-6 sm:mb-8">
              Meals planned, <br />
              <span className="text-[#F05133] italic">sanity saved.</span>
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-slate-500 max-w-xl mb-8 sm:mb-10 font-medium leading-relaxed">
              Stop googling "toddler dinner ideas" at 9 PM. We create realistic 30-day meal plans customized for your child's age, likes, and your cooking capacity.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <button
                onClick={handleNext}
                className="bg-primary-yellow px-6 sm:px-10 py-4 sm:py-5 rounded-lg font-bold text-lg sm:text-xl shadow-[0_4px_0_0_#D1AC00] hover:shadow-[0_2px_0_0_#D1AC00] hover:translate-y-[2px] transition-all active:translate-y-[4px] active:shadow-none"
              >
                Try 3meals free
              </button>
              <button
                onClick={() => setShowReturningUserModal(true)}
                className="px-6 sm:px-8 py-4 sm:py-5 rounded-lg font-bold text-base sm:text-lg border-2 border-gray-200 text-slate-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                I already have a plan
              </button>
            </div>

            <p className="mt-6 sm:mt-8 text-slate-400 font-medium flex flex-wrap items-center gap-2 text-sm sm:text-base">
              <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
              <span>No-typing setup • Age-appropriate textures • Grocery lists</span>
            </p>
          </div>

          <div className="relative group hidden md:block">
            <div className="absolute -inset-4 bg-primary-yellow/10 rounded-3xl blur-2xl group-hover:bg-primary-yellow/20 transition-all"></div>
            <div className="relative bg-white border border-gray-100 rounded-2xl shadow-2xl overflow-hidden rotate-2 hover:rotate-0 transition-transform duration-500">
              <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Preview: Week 1</div>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { day: 'Mon', b: 'Banana Oat Pancakes', l: 'Avocado Toast Strips', d: 'Sweet Potato Pasta' },
                  { day: 'Tue', b: 'Greek Yogurt & Berries', l: 'Cheesy Egg Bites', d: 'Mild Turkey Chili' },
                  { day: 'Wed', b: 'Apple Cinnamon Porridge', l: 'Spinach Turkey Roll-ups', d: 'Salmon Cakes & Peas' }
                ].map((row, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <div className="w-10 text-xs font-bold text-slate-400 uppercase">{row.day}</div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div className="h-10 bg-slate-50 rounded flex items-center px-2 text-[10px] font-medium text-slate-600 border border-slate-100">{row.b}</div>
                      <div className="h-10 bg-[#EFF6FF] rounded flex items-center px-2 text-[10px] font-medium text-[#1E40AF] border border-[#DBEAFE]">{row.l}</div>
                      <div className="h-10 bg-[#FFF9E6] rounded flex items-center px-2 text-[10px] font-medium text-[#7A5C00] border border-[#FFE7A3]">{row.d}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-brand-dark p-4 text-white flex items-center justify-between">
                <div className="text-xs font-bold">🛒 Automatic Grocery List Generated</div>
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                   <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"/></svg>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Returning User Modal */}
        {showReturningUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
              <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-2xl font-serif-brand text-brand-dark">Welcome back!</h3>
                  <p className="text-slate-400 text-sm font-medium mt-1">Enter your email to retrieve your plan</p>
                </div>
                <button
                  onClick={() => {
                    setShowReturningUserModal(false);
                    setEmailError(null);
                    setEmail('');
                  }}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleReturningUserSubmit} className="p-8 space-y-4">
                <div>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-6 py-4 rounded-xl border-2 text-lg font-medium outline-none transition-all ${
                      emailError
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-200 focus:border-brand-dark'
                    }`}
                  />
                  {emailError && (
                    <p className="text-red-500 text-sm font-medium mt-2">{emailError}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoadingPlan}
                  className="w-full bg-[#2563EB] text-white py-4 rounded-xl font-bold text-lg hover:brightness-110 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoadingPlan ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Finding your plan...
                    </>
                  ) : (
                    <>
                      Get My Plan
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                      </svg>
                    </>
                  )}
                </button>

                <p className="text-center text-sm text-slate-400 font-medium">
                  Don't have a plan yet?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setShowReturningUserModal(false);
                      setEmailError(null);
                      setEmail('');
                      handleNext();
                    }}
                    className="text-[#2563EB] font-bold hover:underline"
                  >
                    Create one free
                  </button>
                </p>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <FormHeader />

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 pb-12 sm:pb-20">
        <div className="flex items-start gap-3 sm:gap-4 mb-6 sm:mb-8">
          <button
            onClick={handlePrev}
            className="w-9 h-9 sm:w-10 sm:h-10 border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors flex-shrink-0 mt-1"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif-brand text-brand-dark">
            {step === 1 && "Tell us about your little human"}
            {step === 2 && "What's working right now?"}
            {step === 3 && "What's off the table?"}
            {step === 4 && "How real are we keeping it?"}
          </h2>
        </div>

        {step === 1 && (
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">How old are they?</label>
              <div className="flex flex-wrap gap-2">
                {['6-9 months', '9-12 months', '1 year', '18 months', '2 years', '3+ years'].map(age => (
                  <button
                    key={age}
                    onClick={() => setPrefs({...prefs, age})}
                    className={`px-5 py-2.5 rounded-full border-2 text-sm font-bold transition-all ${
                      prefs.age === age
                        ? 'border-[#1A1F2B] bg-[#1A1F2B] !text-white'
                        : 'border-gray-100 text-brand-dark hover:border-gray-300'
                    }`}
                  >
                    {age}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or specify exact age..."
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.age}
                onChange={(e) => setPrefs({...prefs, age: e.target.value})}
              />
              {(prefs.age === '6-9 months' || prefs.age === '9-12 months') && (
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg mt-3">
                  <span className="text-amber-600 text-lg">⚠️</span>
                  <p className="text-sm text-amber-800 font-medium">
                    For babies just starting solids, always consult your pediatrician before introducing new foods. This plan is for inspiration only.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Eating Style</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  { value: 'purees', label: 'Purees / Spoon-fed', desc: 'Smooth textures, being fed' },
                  { value: 'finger-foods', label: 'Soft Finger Foods', desc: 'Self-feeding, soft pieces' },
                  { value: 'table-food', label: 'Table Food', desc: 'Family meals, uses fork & spoon' },
                  { value: 'mixed', label: 'Mix of Styles', desc: 'Combination depending on meal' }
                ] as const).map((style) => (
                  <button
                    key={style.value}
                    onClick={() => setPrefs({...prefs, eatingStyle: style.value})}
                    className={`px-4 py-4 rounded-lg border-2 text-sm font-bold transition-all text-left ${
                      prefs.eatingStyle === style.value
                        ? 'border-brand-dark bg-gray-50'
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div>{style.label}</div>
                    <div className="text-xs font-medium text-slate-400 mt-1">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            
            <button 
              disabled={!prefs.age}
              onClick={handleNext}
              className="w-full bg-[#2563EB] text-white py-4 rounded-lg font-bold text-lg hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {!prefs.age ? "Select age to continue" : "Next step"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Fan Favorites</label>
              <div className="flex flex-wrap gap-2">
                {['Pasta', 'Yogurt', 'Berries', 'Eggs', 'Chicken', 'Toast', 'Cheese', 'Avocado'].map(item => (
                  <button
                    key={item}
                    onClick={() => toggleItem('favorites', item)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                      prefs.favorites.includes(item)
                        ? 'border-brand-dark bg-gray-50' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea 
                rows={3}
                placeholder="Add other favorites (optional)..."
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.favorites}
                onChange={(e) => setPrefs({...prefs, favorites: e.target.value})}
              />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Healthy Goals</label>
              <p className="text-xs text-slate-500 font-medium italic -mt-2 mb-2">What do you want them to eat more of?</p>
              <div className="flex flex-wrap gap-2">
                {['Veggies', 'Protein', 'Iron-rich', 'Fruit', 'Fiber', 'Healthy Fats', 'New Textures', 'Leafy Greens'].map(item => (
                  <button
                    key={item}
                    onClick={() => toggleItem('wantsMoreOf', item)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                      prefs.wantsMoreOf.includes(item)
                        ? 'border-[#10B981] bg-[#ECFDF5] text-[#065F46]' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea 
                rows={3}
                placeholder="Any other specific nutritional goals (optional)?"
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.wantsMoreOf}
                onChange={(e) => setPrefs({...prefs, wantsMoreOf: e.target.value})}
              />
            </div>

            <button onClick={handleNext} className="w-full bg-[#2563EB] text-white py-4 rounded-lg font-bold text-lg hover:brightness-110 transition-all">
              {prefs.favorites || prefs.wantsMoreOf ? "Next step" : "Skip this step"}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-sm font-bold text-red-400 uppercase tracking-widest">Strict Allergens (Hard NO)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleItem('allergies', 'None')}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                    !prefs.allergies ? 'border-brand-dark bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  None
                </button>
                {['Dairy', 'Eggs', 'Peanuts', 'Tree Nuts', 'Wheat', 'Soy', 'Fish'].map(item => (
                  <button
                    key={item}
                    onClick={() => toggleItem('allergies', item)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                      prefs.allergies.includes(item)
                        ? 'border-red-500 bg-red-50 text-red-700' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <input 
                placeholder="Other strict allergies (optional)..."
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.allergies}
                onChange={(e) => setPrefs({...prefs, allergies: e.target.value})}
              />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">General Dislikes</label>
              <p className="text-xs text-slate-500 font-medium italic -mt-2 mb-2">Anything they just won't touch or aren't ready for?</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => toggleItem('hatesGags', 'None')}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                    !prefs.hatesGags ? 'border-brand-dark bg-gray-50' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  None
                </button>
                {['Broccoli', 'Mushrooms', 'Onions', 'Garlic', 'Spicy', 'Lumps', 'Bitter Greens', 'Strong Smells', 'Soggy Foods', 'Slimy Textures', 'Too Much Color'].map(item => (
                  <button
                    key={item}
                    onClick={() => toggleItem('hatesGags', item)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                      prefs.hatesGags.includes(item)
                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <textarea 
                rows={3}
                placeholder="Anything else (optional)..."
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.hatesGags}
                onChange={(e) => setPrefs({...prefs, hatesGags: e.target.value})}
              />
            </div>

            <button onClick={handleNext} className="w-full bg-[#2563EB] text-white py-4 rounded-lg font-bold text-lg hover:brightness-110 transition-all">
              Next step
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-10">
            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Cooking Capacity</label>
              <div className="space-y-3">
                {(['surviving', 'batching', 'mixed'] as CookingSituation[]).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPrefs({...prefs, cookingSituation: style})}
                    className={`w-full px-6 py-6 rounded-lg border-2 text-left transition-all ${
                      prefs.cookingSituation === style 
                        ? 'border-brand-dark bg-gray-50 shadow-inner' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-brand-dark">
                          {style === 'surviving' ? 'I\'m just surviving' : style === 'batching' ? 'I can batch prep' : 'A healthy mix'}
                        </p>
                        <p className="text-sm text-slate-500 mt-1 font-medium">
                          {style === 'surviving' ? "Keep it ultra-simple. Low effort only." : style === 'batching' ? "I have time on weekends to prep ahead." : "Fresh some days, prepped others."}
                        </p>
                      </div>
                      {prefs.cookingSituation === style && (
                        <div className="w-6 h-6 bg-brand-dark rounded-full flex items-center justify-center text-white">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-slate-400 uppercase tracking-widest">Dietary Preferences</label>
              <div className="flex flex-wrap gap-2">
                {['Organic', 'Vegan', 'Vegetarian', 'Gluten-Free', 'Low Sodium', 'No Sugar Added', 'No Salt', 'Grass-Fed', 'Pasture-Raised'].map(item => (
                  <button
                    key={item}
                    onClick={() => toggleItem('dietaryPreferences', item)}
                    className={`px-4 py-2 rounded-lg border-2 text-sm font-bold transition-all ${
                      prefs.dietaryPreferences.includes(item)
                        ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#1E40AF]' 
                        : 'border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <input 
                placeholder="Specific brands or philosophies (optional)..."
                className="w-full px-4 py-4 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none transition-all font-medium"
                value={prefs.dietaryPreferences}
                onChange={(e) => setPrefs({...prefs, dietaryPreferences: e.target.value})}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-600 rounded-lg border border-red-100 text-sm font-bold">
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              className="w-full bg-[#2563EB] text-white py-4 rounded-lg font-bold text-lg hover:brightness-110 shadow-lg shadow-blue-200 transition-all active:scale-[0.98]"
            >
              Generate My Plan
            </button>
          </div>
        )}
      </div>

      {/* Returning User Modal */}
      {showReturningUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-dark/40 backdrop-blur-md">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100">
            <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div>
                <h3 className="text-2xl font-serif-brand text-brand-dark">Welcome back!</h3>
                <p className="text-slate-400 text-sm font-medium mt-1">Enter your email to retrieve your plan</p>
              </div>
              <button
                onClick={() => {
                  setShowReturningUserModal(false);
                  setEmailError(null);
                  setEmail('');
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-slate-500 hover:text-brand-dark transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReturningUserSubmit} className="p-8 space-y-4">
              <div>
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-6 py-4 rounded-xl border-2 text-lg font-medium outline-none transition-all ${
                    emailError
                      ? 'border-red-300 focus:border-red-500'
                      : 'border-gray-200 focus:border-brand-dark'
                  }`}
                />
                {emailError && (
                  <p className="text-red-500 text-sm font-medium mt-2">{emailError}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoadingPlan}
                className="w-full bg-[#2563EB] text-white py-4 rounded-xl font-bold text-lg hover:brightness-110 shadow-lg shadow-blue-200 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoadingPlan ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Finding your plan...
                  </>
                ) : (
                  <>
                    Get My Plan
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                    </svg>
                  </>
                )}
              </button>

              <p className="text-center text-sm text-slate-400 font-medium">
                Don't have a plan yet?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setShowReturningUserModal(false);
                    setEmailError(null);
                    setEmail('');
                    handleNext();
                  }}
                  className="text-[#2563EB] font-bold hover:underline"
                >
                  Create one free
                </button>
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
