import React, { useState, useEffect, useRef } from 'react';
import { useChunker } from './hooks/useChunker';
import { useRecorder } from './hooks/useRecorder';
import { useLearnerProfile } from './hooks/useLearnerProfile';
import { Flashcard } from './components/Flashcard';
import { RecordButton } from './components/RecordButton';
import { Feedback } from './components/Feedback';
import { effectiveStatus } from './utils/feedback';
import { Eye, Ban, RotateCcw, ArrowLeftRight } from 'lucide-react';
import { Lexicon } from './components/Lexicon';
import { XPBar } from './components/XPBar';
import { aiService } from './services/aiService';
import { log } from './utils/logger';
import polishWords from './data/words.json';

import './index.css';

const MODES = ['input', 'recall'];

function App() {
  const { workingSet, gameState, dueCount, recordSuccess, recordFailure, suspendWord, resetProgress } = useChunker();
  const recorder = useRecorder();
  const profile = useLearnerProfile();

  // Keep a live ref so effects/handlers can reach the recorder without re-subscribing.
  const recorderRef = useRef(recorder);
  recorderRef.current = recorder;

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [modeIndex, setModeIndex] = useState(0);
  const [feedback, setFeedback] = useState(null); // data object — see components/Feedback.jsx
  const [pendingResult, setPendingResult] = useState(null); // { success, id } committed on Next
  const [showLexicon, setShowLexicon] = useState(false);

  const currentWord = workingSet[currentWordIndex];
  const currentMode = MODES[modeIndex];

  // Keep the index in range as the working set resizes.
  useEffect(() => {
    if (workingSet.length > 0 && currentWordIndex >= workingSet.length) {
      setCurrentWordIndex(0);
    }
  }, [workingSet.length, currentWordIndex]);

  // Surface microphone/recorder errors to the user.
  useEffect(() => {
    if (recorder.error) setFeedback({ status: 'error', message: recorder.error });
  }, [recorder.error]);

  // On each word/mode change: clear feedback, and auto-start recording in recall mode.
  useEffect(() => {
    setFeedback(null);
    if (!currentWord) return;
    log('flow', 'word/mode effect', { wordId: currentWord.id, polish: currentWord.polish, mode: currentMode });
    if (currentMode === 'recall') {
      log('flow', 'auto-start recording (non-gesture)', { wordId: currentWord.id });
      recorderRef.current.start();
    }
    return () => {
      log('flow', 'effect cleanup -> cancel', { wordId: currentWord.id, mode: currentMode });
      recorderRef.current.cancel();
    };
    // recorder is reached via ref; depend only on the word/mode identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWord?.id, currentMode]);

  const advance = () => {
    setFeedback(null);
    if (modeIndex < MODES.length - 1) {
      setModeIndex(modeIndex + 1);
    } else {
      setModeIndex(0);
      if (workingSet.length > 0) {
        setCurrentWordIndex((i) => (i + 1) % workingSet.length);
      }
    }
  };

  const handleNext = () => {
    log('button', 'next', { wordId: currentWord?.id, mode: currentMode, hasPending: !!pendingResult });
    if (pendingResult) {
      if (pendingResult.success) recordSuccess(pendingResult.id);
      else recordFailure(pendingResult.id);
      setPendingResult(null);
    }
    advance();
  };

  const validateRecording = async () => {
    log('flow', 'validateRecording:stop', { wordId: currentWord.id });
    const blob = await recorderRef.current.stop();
    if (!blob || blob.size < 1000) {
      log('flow', 'validateRecording:blob too small', { bytes: blob?.size ?? 0 });
      setFeedback({ status: 'error', message: 'Audio too short/empty. Please try again.' });
      return;
    }

    setFeedback({ status: 'processing' });
    try {
      const result = await aiService.validatePronunciation(blob, currentWord.polish);
      log('flow', 'validate:result', { correct: result.correct, heard: result.heard });

      // Feed the learner profile (fire-and-forget classification happens inside).
      profile.recordAttempt({
        wordId: currentWord.id,
        polish: currentWord.polish,
        phonetic: currentWord.phonetic,
        heard: result.heard,
        correct: result.correct,
        confidence: result.confidence,
      });

      if (result.correct) {
        setFeedback({ status: 'correct', heard: result.heard });
        setPendingResult({ success: true, id: currentWord.id });
      } else {
        setFeedback({ status: 'incorrect', heard: result.heard, adviceLoading: true });
        setPendingResult({ success: false, id: currentWord.id });

        // Tier 3: lazy coaching, personalized with the learner profile excerpt.
        aiService.getCoachAdvice(currentWord.polish, result.heard, { profileExcerpt: profile.profileExcerpt, phonetic: currentWord.phonetic }).then((advice) => {
          setFeedback((prev) =>
            prev && prev.status === 'incorrect' ? { ...prev, advice, adviceLoading: false } : prev
          );
        });
      }
    } catch (err) {
      console.error('Validation error:', err);
      setFeedback({ status: 'error', message: `Error: ${err.message}` });
    }
  };

  const handleRecordToggle = () => {
    // Ignore a stray/rapid re-trigger while a result is being processed (belt-and-suspenders
    // alongside the RecordButton single-event fix).
    if (feedback?.status === 'processing') {
      log('button', 'recordToggle ignored (processing)');
      return;
    }
    log('button', 'recordToggle', { isRecording: recorder.isRecording, wordId: currentWord?.id, mode: currentMode });
    if (recorder.isRecording) {
      validateRecording();
    } else {
      recorderRef.current.start();
    }
  };

  const handleRetry = () => {
    log('button', 'retry', { wordId: currentWord?.id });
    setFeedback(null);
    setPendingResult(null);
    recorderRef.current.start();
  };

  const handleGiveUp = () => {
    if (!currentWord) return;
    log('button', 'giveUp', { wordId: currentWord.id });
    recorderRef.current.cancel();
    profile.recordAttempt({ wordId: currentWord.id, polish: currentWord.polish, phonetic: currentWord.phonetic, heard: '(gave up)', correct: false, confidence: 0 });
    setFeedback({ status: 'revealed', advice: 'Marked as incorrect. Listen and repeat.' });
    setPendingResult({ success: false, id: currentWord.id });
  };

  const handleSuspend = () => {
    if (!currentWord) return;
    if (confirm(`Permanently suspend "${currentWord.polish}" from learning?`)) {
      recorderRef.current.cancel();
      suspendWord(currentWord.id);
      setPendingResult(null);
      advance();
    }
  };

  // Manual override: toggles what will be committed on Next. A second press restores the
  // original result untouched (the feedback object is preserved; only `swapped` flips).
  const handleSwap = () => {
    if (!currentWord || !feedback) return;
    const next = { ...feedback, swapped: !feedback.swapped };
    setFeedback(next);
    setPendingResult({ success: effectiveStatus(next) === 'correct', id: currentWord.id });
  };

  const playAudio = (word) => {
    if (word.audio) {
      const audio = new Audio(`${import.meta.env.BASE_URL}${word.audio}`);
      audio.play().catch((e) => console.error('Audio play failed:', e));
    } else {
      const utterance = new SpeechSynthesisUtterance(word.polish);
      utterance.lang = 'pl-PL';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Global Enter shortcut.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Enter' || showLexicon || !currentWord) return;

      if (currentMode === 'input') {
        handleNext();
        return;
      }
      // Recall mode: Enter advances if we have a result, otherwise toggles recording.
      const hasResult = feedback && feedback.status !== 'processing' && feedback.status !== 'error';
      if (hasResult) handleNext();
      else handleRecordToggle();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback, showLexicon, currentWord?.id, currentMode, recorder.isRecording]);

  if (!currentWord) return <div>Loading...</div>;

  const knownWords = Object.keys(gameState.words)
    .map((id) => polishWords.find((w) => w.id == id)?.polish)
    .filter(Boolean);

  const hasResult = feedback && feedback.status !== 'processing' && feedback.status !== 'error';
  const showRecordButton = currentMode === 'recall' && !hasResult;
  const canSwap = feedback && (feedback.status === 'correct' || feedback.status === 'incorrect');

  return (
    <div className="app-container">
      <div className="header-controls">
        <h1>PolishFlow</h1>
        <button className="progress-btn" onClick={() => setShowLexicon(true)}>
          📖 Lexicon
        </button>
      </div>

      <XPBar xp={gameState.xp} level={gameState.level} />

      <div className="progress-info">
        {dueCount > 0
          ? <span style={{ color: 'var(--warning-color)' }}>Reviews Due: {dueCount}</span>
          : <span style={{ color: 'var(--success-color)' }}>All Caught Up!</span>}
        <span style={{ opacity: 0.5, margin: '0 8px' }}>|</span>
        Bucket: {gameState.words[currentWord.id]?.bucket || 0}/5
      </div>

      <div className="mode-indicator">
        Current Mode: <strong>{currentMode.toUpperCase()}</strong>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          filter: `drop-shadow(0 0 ${recorder.volume * 30}px rgba(56, 189, 248, ${0.4 + recorder.volume * 0.6}))`,
          transition: 'filter 0.1s ease-out'
        }}>
          <Flashcard
            key={currentWord.id}
            word={currentWord}
            knownWords={knownWords}
            attempted={!!feedback}
            profileExcerpt={profile.profileExcerpt}
          />
        </div>
      </div>

      <div className="controls">
        <button
          className="skip-button"
          onClick={handleGiveUp}
          title="Reveal the answer and mark this attempt incorrect"
          aria-label="Give up and reveal the answer"
        >
          <Eye size={16} aria-hidden="true" /> Give Up
        </button>

        <button
          className="suspend-button"
          onClick={handleSuspend}
          title="Remove this word from your curriculum permanently"
          aria-label="Suspend this word from the curriculum"
        >
          <Ban size={16} aria-hidden="true" /> Suspend
        </button>

        {showRecordButton ? (
          <RecordButton isRecording={recorder.isRecording} onRecord={handleRecordToggle} />
        ) : (
          <button className="next-button" onClick={handleNext}>
            {currentMode === 'input' ? 'Next ➡️' : 'Next Word ➡️'}
          </button>
        )}
      </div>

      {effectiveStatus(feedback) === 'incorrect' && (
        <div style={{ marginTop: '1rem' }}>
          <button className="progress-btn" onClick={handleRetry} aria-label="Record this word again">
            <RotateCcw size={16} aria-hidden="true" /> Try Again
          </button>
        </div>
      )}

      {feedback && (
        <div className="feedback" style={{ position: 'relative' }}>
          <Feedback feedback={feedback} word={currentWord} onAudioPlay={playAudio} profileExcerpt={profile.profileExcerpt} />
          {canSwap && (
            <button
              className="swap-btn"
              onClick={handleSwap}
              title={feedback.swapped ? 'Restore the original result' : 'Override the AI and flip this result'}
              aria-label={
                effectiveStatus(feedback) === 'correct' ? 'Mark as incorrect instead' : 'Mark as correct instead'
              }
            >
              <ArrowLeftRight size={14} aria-hidden="true" />
              {feedback.swapped
                ? 'Restore result'
                : effectiveStatus(feedback) === 'correct' ? 'Mark incorrect' : 'Mark correct'}
            </button>
          )}
        </div>
      )}

      {showLexicon && (
        <Lexicon
          gameState={gameState}
          allWords={polishWords}
          profile={profile}
          onClose={() => setShowLexicon(false)}
          onReset={() => { profile.reset(); resetProgress(); }}
        />
      )}
    </div>
  );
}

export default App;
