import React, { useState, useEffect } from 'react';
import { 
  X, 
  Brain, 
  Sparkles, 
  Volume2, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  ArrowRight, 
  Layers, 
  HelpCircle,
  Award,
  Bookmark,
  Check,
  Eye,
  Shuffle
} from 'lucide-react';
import { DictionaryEntry } from '../types';
import { getBookmarkedWords, getAllStoredWords } from '../db/indexedDB';

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWord?: (word: string) => void;
}

type QuizType = 'multiple-choice' | 'flashcards';

interface QuizQuestion {
  targetWord: DictionaryEntry;
  correctDefinition: string;
  partOfSpeech: string;
  options: string[]; // 4 definitions for multiple choice
  correctOptionIndex: number;
}

export const QuizModal: React.FC<QuizModalProps> = ({
  isOpen,
  onClose,
  onSelectWord,
}) => {
  const [bookmarks, setBookmarks] = useState<DictionaryEntry[]>([]);
  const [allDbWords, setAllDbWords] = useState<DictionaryEntry[]>([]);
  const [quizType, setQuizType] = useState<QuizType>('multiple-choice');
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  
  // Flashcard states
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardKnownCount, setFlashcardKnownCount] = useState(0);

  // Audio playing
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDataAndSetupQuiz();
    }
  }, [isOpen, quizType]);

  const loadDataAndSetupQuiz = async () => {
    try {
      const saved = await getBookmarkedWords();
      const dbAll = await getAllStoredWords();
      setBookmarks(saved);
      setAllDbWords(dbAll);

      // Use saved bookmarks if available, or fallback to DB words if < 2 bookmarks
      const pool = saved.length >= 2 ? saved : dbAll;

      if (pool.length > 0) {
        generateQuestions(pool, dbAll);
      }
    } catch {
      setBookmarks([]);
    }
  };

  const generateQuestions = (targetPool: DictionaryEntry[], distractorPool: DictionaryEntry[]) => {
    // Shuffle target pool
    const shuffledPool = [...targetPool].sort(() => Math.random() - 0.5);
    
    // Fallback definitions in case distractor pool is too small
    const genericDistractors = [
      "To express strong disapproval or criticism of something formally.",
      "A state of noise, confusion, and excitement caused by large crowd.",
      "Showing or requiring great care, attention, and effort.",
      "To cause something to become smaller or less intense over time.",
      "Having a hidden or secret meaning or purpose.",
      "Existing or occurring in large amounts or great quantities.",
      "To make something clear or easy to understand by explanation.",
      "A temporary pause or rest from something difficult or unpleasant."
    ];

    const questions: QuizQuestion[] = shuffledPool.map(target => {
      const meaning = target.meanings[0];
      const correctDef = meaning?.definitions[0]?.definition || "A word definition";
      const partOfSpeech = meaning?.partOfSpeech || "word";

      // Collect potential wrong definitions
      let wrongDefs: string[] = [];

      // 1. From distractor pool (other words)
      distractorPool.forEach(item => {
        if (item.word.toLowerCase() !== target.word.toLowerCase()) {
          item.meanings.forEach(m => {
            m.definitions.forEach(d => {
              if (d.definition && d.definition !== correctDef) {
                wrongDefs.push(d.definition);
              }
            });
          });
        }
      });

      // Filter duplicates
      wrongDefs = Array.from(new Set(wrongDefs));

      // If not enough wrong definitions, top up with generic distractors
      if (wrongDefs.length < 3) {
        genericDistractors.forEach(gd => {
          if (gd !== correctDef && !wrongDefs.includes(gd)) {
            wrongDefs.push(gd);
          }
        });
      }

      // Randomly pick 3 wrong definitions
      const selectedWrong = wrongDefs.sort(() => Math.random() - 0.5).slice(0, 3);

      // Combine with correct option and shuffle
      const options = [correctDef, ...selectedWrong].sort(() => Math.random() - 0.5);
      const correctIndex = options.indexOf(correctDef);

      return {
        targetWord: target,
        correctDefinition: correctDef,
        partOfSpeech,
        options,
        correctOptionIndex: correctIndex,
      };
    });

    setQuizQuestions(questions);
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswerSubmitted(false);
    setScore(0);
    setIsFinished(false);
    setIsFlipped(false);
    setFlashcardKnownCount(0);
  };

  const handleOptionSelect = (index: number) => {
    if (isAnswerSubmitted) return;
    setSelectedOption(index);
    setIsAnswerSubmitted(true);

    if (index === quizQuestions[currentIndex].correctOptionIndex) {
      setScore(prev => prev + 1);
    }
  };

  const handleNextQuestion = () => {
    if (currentIndex < quizQuestions.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswerSubmitted(false);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
    }
  };

  const handleFlashcardReview = (remembered: boolean) => {
    if (remembered) {
      setFlashcardKnownCount(prev => prev + 1);
    }
    handleNextQuestion();
  };

  const handlePlayAudio = (e: React.MouseEvent, word: string, audioUrl?: string) => {
    e.stopPropagation();
    setIsPlayingAudio(true);

    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(() => playSpeechFallback(word));
      audio.onended = () => setIsPlayingAudio(false);
    } else {
      playSpeechFallback(word);
    }
  };

  const playSpeechFallback = (word: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      window.speechSynthesis.speak(utterance);
    } else {
      setIsPlayingAudio(false);
    }
  };

  if (!isOpen) return null;

  const currentQ = quizQuestions[currentIndex];
  const totalQuestions = quizQuestions.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-violet-600 text-white shadow-md shadow-violet-500/20">
              <Brain className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Vocabulary Quiz
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Practice and memorize your bookmarked words
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector & Stats Bar */}
        <div className="py-4 flex items-center justify-between gap-4 flex-wrap flex-shrink-0 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
            <button
              onClick={() => setQuizType('multiple-choice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                quizType === 'multiple-choice'
                  ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Multiple Choice</span>
            </button>

            <button
              onClick={() => setQuizType('flashcards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                quizType === 'flashcards'
                  ? 'bg-white dark:bg-slate-900 text-violet-600 dark:text-violet-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Flashcards</span>
            </button>
          </div>

          {/* Question Counter / Pool status */}
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5 text-violet-500" />
            <span>Pool: {bookmarks.length} saved word{bookmarks.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        {/* Main Quiz Content */}
        <div className="flex-grow overflow-y-auto py-6 pr-1">
          
          {/* Empty state if no words available */}
          {totalQuestions === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-violet-50 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Bookmark className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  No Saved Words for Quiz
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Bookmark words while searching or discovering vocabulary to build your personalized quiz deck!
                </p>
              </div>
              <button
                onClick={() => {
                  if (allDbWords.length > 0) {
                    generateQuestions(allDbWords, allDbWords);
                  }
                }}
                className="mt-4 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm"
              >
                <Shuffle className="w-4 h-4" />
                <span>Practice with Sample Words ({allDbWords.length})</span>
              </button>
            </div>
          ) : isFinished ? (
            
            /* Quiz Completed Summary Screen */
            <div className="text-center py-8 space-y-6 animate-fade-in">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-50 dark:bg-amber-950/50 text-amber-500 dark:text-amber-400 flex items-center justify-center shadow-inner">
                <Award className="w-10 h-10" />
              </div>

              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  Quiz Completed!
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Great effort strengthening your vocabulary retention.
                </p>
              </div>

              {/* Score Display Card */}
              <div className="max-w-md mx-auto p-6 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 space-y-3">
                <div className="text-4xl font-extrabold text-violet-600 dark:text-violet-400">
                  {quizType === 'multiple-choice' ? `${score} / ${totalQuestions}` : `${flashcardKnownCount} / ${totalQuestions}`}
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {quizType === 'multiple-choice' ? 'Correct Answers' : 'Words Memorized'}
                </p>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div 
                    className="bg-violet-600 h-2.5 rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round(
                        ((quizType === 'multiple-choice' ? score : flashcardKnownCount) / totalQuestions) * 100
                      )}%`
                    }}
                  />
                </div>
              </div>

              {/* Retry & Return Actions */}
              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => generateQuestions(bookmarks.length >= 2 ? bookmarks : allDbWords, allDbWords)}
                  className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-2xl text-sm flex items-center gap-2 shadow-md shadow-violet-500/20 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-2xl text-sm transition-all"
                >
                  <span>Done</span>
                </button>
              </div>
            </div>

          ) : quizType === 'multiple-choice' ? (
            
            /* Multiple Choice Mode */
            <div className="space-y-6">
              
              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>Question {currentIndex + 1} of {totalQuestions}</span>
                  <span>Score: {score}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
                  />
                </div>
              </div>

              {/* Target Word Prompt */}
              <div className="p-6 rounded-2xl bg-violet-50/60 dark:bg-violet-950/40 border border-violet-100 dark:border-violet-900/60 text-center space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                  What is the definition of
                </span>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white capitalize">
                    {currentQ.targetWord.word}
                  </h2>
                  <button
                    onClick={(e) => handlePlayAudio(e, currentQ.targetWord.word, currentQ.targetWord.phonetics?.find(p => p.audio)?.audio)}
                    disabled={isPlayingAudio}
                    className="p-2 rounded-full bg-violet-100 dark:bg-violet-900/80 text-violet-600 dark:text-violet-300 hover:bg-violet-600 hover:text-white transition-colors"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-md bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300 font-semibold lowercase inline-block">
                  {currentQ.partOfSpeech}
                </span>
              </div>

              {/* Options Grid */}
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  let buttonStyle = "bg-slate-50 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 hover:border-violet-400";
                  
                  if (isAnswerSubmitted) {
                    if (idx === currentQ.correctOptionIndex) {
                      buttonStyle = "bg-green-50 dark:bg-green-950/60 border-green-500 text-green-800 dark:text-green-200 font-medium";
                    } else if (selectedOption === idx) {
                      buttonStyle = "bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-800 dark:text-rose-200";
                    } else {
                      buttonStyle = "opacity-50 bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800 text-slate-400";
                    }
                  }

                  return (
                    <button
                      key={idx}
                      onClick={() => handleOptionSelect(idx)}
                      disabled={isAnswerSubmitted}
                      className={`w-full p-4 rounded-xl border text-left text-xs sm:text-sm leading-relaxed transition-all flex items-start gap-3 cursor-pointer ${buttonStyle}`}
                    >
                      <span className="w-6 h-6 rounded-lg bg-slate-200/70 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="flex-1">{option}</span>
                      
                      {isAnswerSubmitted && idx === currentQ.correctOptionIndex && (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
                      )}
                      {isAnswerSubmitted && selectedOption === idx && idx !== currentQ.correctOptionIndex && (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Next Question Footer */}
              {isAnswerSubmitted && (
                <div className="pt-2 flex justify-end animate-fade-in">
                  <button
                    onClick={handleNextQuestion}
                    className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-violet-500/20 transition-all"
                  >
                    <span>{currentIndex < totalQuestions - 1 ? 'Next Question' : 'See Results'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>

          ) : (

            /* Flashcards Mode */
            <div className="space-y-6">
              
              {/* Progress */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                <span>Card {currentIndex + 1} of {totalQuestions}</span>
                <span>Tap card to reveal definition</span>
              </div>

              {/* Flashcard Box */}
              <div
                onClick={() => setIsFlipped(!isFlipped)}
                className="w-full min-h-[260px] p-8 rounded-3xl bg-slate-50 dark:bg-slate-800/80 border-2 border-dashed border-violet-200 dark:border-violet-900/80 hover:border-violet-500 transition-all flex flex-col items-center justify-center text-center cursor-pointer relative shadow-sm group"
              >
                {!isFlipped ? (
                  <div className="space-y-4 animate-fade-in">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      Target Word
                    </span>
                    <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white capitalize">
                      {currentQ.targetWord.word}
                    </h2>
                    {currentQ.targetWord.phonetic && (
                      <p className="text-base font-serif italic text-slate-500 dark:text-slate-400">
                        {currentQ.targetWord.phonetic}
                      </p>
                    )}
                    <div className="pt-2 flex items-center justify-center gap-2 text-xs font-semibold text-slate-400">
                      <Eye className="w-4 h-4" /> Click to flip card
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in max-w-lg">
                    <span className="text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                      Definition & Details
                    </span>
                    <p className="text-lg font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                      {currentQ.correctDefinition}
                    </p>
                    {currentQ.targetWord.meanings[0]?.definitions[0]?.example && (
                      <p className="text-sm italic font-serif text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/60 dark:border-slate-800">
                        "{currentQ.targetWord.meanings[0].definitions[0].example}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Flashcard Review Action Buttons */}
              {isFlipped && (
                <div className="pt-2 flex items-center justify-center gap-4 animate-fade-in">
                  <button
                    onClick={() => handleFlashcardReview(false)}
                    className="px-5 py-3 bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 font-semibold rounded-2xl text-xs sm:text-sm flex items-center gap-2 border border-rose-200 dark:border-rose-800/60 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Need Review</span>
                  </button>
                  <button
                    onClick={() => handleFlashcardReview(true)}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-2xl text-xs sm:text-sm flex items-center gap-2 shadow-md shadow-green-500/20 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Got it Right</span>
                  </button>
                </div>
              )}

            </div>

          )}

        </div>

      </div>
    </div>
  );
};
