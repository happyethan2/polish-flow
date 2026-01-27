import React, { useState, useEffect, useRef } from 'react';
import { useChunker } from './hooks/useChunker';
import { Flashcard } from './components/Flashcard';
import { RecordButton } from './components/RecordButton';
import { Lexicon } from './components/Lexicon';
import { XPBar } from './components/XPBar';
// import { AudioVisualizer } from './components/AudioVisualizer'; // Removed
import { useAudioVolume } from './hooks/useAudioVolume';
import { aiService } from './services/aiService';
import polishWords from './data/words.json';

import './index.css';

const MODES = ['input', 'recall'];

function App() {
  const { workingSet, gameState, dueCount, recordSuccess, recordFailure, markAsKnown, suspendWord, resetProgress } = useChunker();

  // Note: userProgress is now gameState.words
  const userProgress = gameState.words;

  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [modeIndex, setModeIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [pendingResult, setPendingResult] = useState(null); // { success: boolean, id: number }

  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState(null); // Track last result for manual swap
  const [skippedWords, setSkippedWords] = useState(new Set());
  const [showLexicon, setShowLexicon] = useState(false);

  // Audio Recording State
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [rawStream, setRawStream] = useState(null);
  const audioChunksRef = useRef([]);

  // Audio Volume Hook
  const volume = useAudioVolume(rawStream, isRecording);

  const currentWord = workingSet[currentWordIndex];
  const currentMode = MODES[modeIndex];

  // Helper: Next Valid Index
  const getNextValidIndex = (startIndex, words, skipped) => {
    let nextIndex = (startIndex + 1) % words.length;
    let attempts = 0;
    while (skipped.has(words[nextIndex].id) && attempts < words.length) {
      nextIndex = (nextIndex + 1) % words.length;
      attempts++;
    }
    return attempts < words.length ? nextIndex : -1;
  };

  useEffect(() => {
    if (currentWord && skippedWords.has(currentWord.id)) {
      handleNext();
    }
  }, [currentWord, skippedWords]);


  // Auto-Listening Logic
  useEffect(() => {
    console.log(`[AutoRecord] Triggered for Word: ${currentWord?.polish}, Mode: ${currentMode}`);
    let activeStream = null;

    const startMic = async () => {
      try {
        if (rawStream) {
          rawStream.getTracks().forEach(track => track.stop());
        }

        activeStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setRawStream(activeStream);

        const recorder = new MediaRecorder(activeStream);

        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        setMediaRecorder(recorder);

        // Auto-start only in Recall mode
        if (currentMode === 'recall' && currentWord) {
          audioChunksRef.current = [];
          recorder.start();
          setIsRecording(true);
        }

      } catch (err) {
        console.error("[AutoRecord] Error accessing microphone:", err);
        setFeedback("Error: Could not access microphone. Please check permissions.");
      }
    };

    if (currentWord) {
      setFeedback(null);
      startMic();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [currentWord, currentMode]);

  /* Moved key listener to bottom to access handlers */


  const handleNext = () => {
    // Commit Pending Result if exists
    if (pendingResult) {
      if (pendingResult.success) {
        recordSuccess(pendingResult.id);
      } else {
        recordFailure(pendingResult.id);
      }
      setPendingResult(null);
    }

    setFeedback(null);
    setIsRecording(false);
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }

    if (modeIndex < MODES.length - 1) {
      setModeIndex(modeIndex + 1);
    } else {
      setModeIndex(0);
      if (workingSet.length > 0) {
        const nextIndex = getNextValidIndex(currentWordIndex, workingSet, skippedWords);
        if (nextIndex !== -1) {
          setCurrentWordIndex(nextIndex);
        } else {
          // Reset skips if cycle done or handle gracefully
          // Ensure we don't endless loop
          setSkippedWords(new Set());
        }
      }
    }
  };

  // SRS Replacements
  const handleGiveUp = () => {
    if (!currentWord) return;

    // Immediate SRS Penalty (Bucket 0)
    recordFailure(currentWord.id);
    setLastResult({ wasCorrect: false });

    // Show Feedback immediately (simulate incorrect result)
    let feedbackMsg = (
      <div>
        <div className="main-feedback">❌ Ignored/Failed</div>
        <div className="rich-feedback">
          <p><strong>Expected:</strong> {currentWord.polish}</p>
          <p style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--primary-accent)' }}>
            Pronunciation: "{currentWord.phonetic}"
          </p>
          <div id="coach-bubble" className="coach-bubble">
            💡 Marked as incorrect.
          </div>
        </div>
      </div>
    );

    setFeedback(feedbackMsg);
    setPendingResult({ success: false, id: currentWord.id });
  };

  const handleSuspend = () => {
    if (!currentWord) return;
    if (confirm(`Permanently suspend "${currentWord.polish}" from learning?`)) {
      suspendWord(currentWord.id);
      // Manually cycle to next word immediately
      setTimeout(() => handleNext(), 50);
    }
  };


  /* Removed duplicate isRecording declaration */
  const [audioVolume, setAudioVolume] = useState(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // ... (handleRecord logic)
  const handleRecord = async () => {
    if (!isRecording) {
      // Manual Start / Retry
      audioChunksRef.current = [];
      if (mediaRecorder) {
        try {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();

          // Audio Visualization Setup
          const stream = mediaRecorder.stream; // Use the existing stream from mediaRecorder if accessible, or we might need to get it again? 
          // Actually, mediaRecorder is initialized in useEffect. Let's assume we can access the stream if we store it, or create a new context from the stream.
          // Wait, mediaRecorder.stream is available.

          if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
          }
          if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
          }

          const source = audioContextRef.current.createMediaStreamSource(stream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          const updateVolume = () => {
            analyser.getByteFrequencyData(dataArray);
            const sum = dataArray.reduce((a, b) => a + b, 0);
            const avg = sum / dataArray.length; // 0-255
            // Normalize and boost sensitivity (avg is usually low for speech)
            const normalized = Math.min(100, (avg / 50) * 100);
            setAudioVolume(normalized);
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };
          updateVolume();

          mediaRecorder.start();
          setIsRecording(true);
          setFeedback(null);
        } catch (e) {
          console.error("Mic error:", e);
          setFeedback("Error starting microphone. Refresh page.");
        }
      }
    } else {
      // STOP and Validate
      setIsRecording(false);
      setAudioVolume(0);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      setFeedback('Processing...');
      // ... rest of stop logic


      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        await new Promise(resolve => {
          mediaRecorder.onstop = resolve;
          mediaRecorder.stop();
        });

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

        if (audioBlob.size < 500) {
          setFeedback("Audio too short/empty. Please try again.");
          return;
        }

        let result;
        if (currentMode === 'recall') {
          result = await aiService.validatePronunciation(audioBlob, currentWord.polish);
        } else {
          result = { correct: true, feedback: "Good practice!" };
        }

        setLastResult({ wasCorrect: result.correct });

        // TIER 1: Immediate Visualization
        let feedbackMsg = (
          <div>
            <div className="main-feedback">
              {result.correct ? "✅ Correct" : "❌ Incorrect"}
            </div>
            <div className="rich-feedback">
              <p><strong>Expected:</strong> {currentWord.polish}</p>
              {result.heard && <p><strong>AI Heard:</strong> {result.heard.toLowerCase()}</p>}

              {/* TIER 2: Static Context (Immediate) */}
              <p style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--primary-accent)' }}>
                Pronunciation: "{currentWord.phonetic}"
              </p>

              {/* TIER 3: Lazy Coach Placeholder */}
              {!result.correct && (
                <div id="coach-bubble" className="coach-bubble loading">
                  Thinking... 🧠
                </div>
              )}
            </div>
          </div>
        );

        setFeedback(feedbackMsg);

        // TIER 3: Lazy Load Coaching
        if (!result.correct) {
          aiService.getCoachAdvice(currentWord.polish, result.heard).then(advice => {
            // Update feedback with advice
            setFeedback(prev => (
              <div>
                <div className="main-feedback">❌ Incorrect</div>
                <div className="rich-feedback">
                  <p><strong>Expected:</strong> {currentWord.polish}</p>
                  {result.heard && <p><strong>AI Heard:</strong> {result.heard.toLowerCase()}</p>}
                  <p style={{ marginTop: '0.5rem', fontStyle: 'italic', opacity: 0.8, color: 'var(--primary-accent)' }}>Pronunciation: "{currentWord.phonetic}"</p>

                  <div id="coach-bubble" className="coach-bubble">
                    💡 {advice}
                  </div>
                </div>
              </div>
            ));
          });
        }

        if (result.correct) {
          if (currentMode === 'recall') {
            // recordSuccess(currentWord.id); // Delayed
            setPendingResult({ success: true, id: currentWord.id });
          }
        } else {
          // recordFailure(currentWord.id); // Delayed
          setPendingResult({ success: false, id: currentWord.id });
        }
      }
    }
  };

  const playAudio = (word) => {
    if (word.audio_cache_url) {
      const audio = new Audio(word.audio_cache_url);
      audio.play().catch(e => console.error("Audio play failed:", e));
    } else {
      // Fallback
      const utterance = new SpeechSynthesisUtterance(word.polish);
      utterance.lang = 'pl-PL';
      window.speechSynthesis.speak(utterance);
    }
  };

  // Global Key Listener (Late binding)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!currentWord) return;

      if (e.key === 'Enter' && !showLexicon) {
        // ERROR FIX: In 'input' mode, Enter should just move to next (Recall), not start recording.
        if (currentMode === 'input') {
          handleNext();
          return;
        }

        // If feedback is shown (and valid), move Next
        if (feedback && feedback !== 'Processing...' && typeof feedback !== 'string') {
          handleNext();
        } else if (!feedback || feedback === 'Processing...') {
          // If no feedback (Idle), toggle Record.
          handleRecord();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [feedback, showLexicon, isRecording, currentWord, currentMode]); // Added currentMode dependence

  if (!currentWord) return <div>Loading...</div>;


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
        {dueCount > 0 ? <span style={{ color: 'var(--warning-color)' }}>Reviews Due: {dueCount}</span> : <span style={{ color: 'var(--success-color)' }}>All Caught Up!</span>}
        <span style={{ opacity: 0.5, margin: '0 8px' }}>|</span>
        Bucket: {gameState.words[currentWord.id]?.bucket || 0}/5
      </div>

      <div className="mode-indicator">
        Current Mode: <strong>{currentMode.toUpperCase()}</strong>
      </div>

      <div style={{ position: 'relative', width: '100%' }}>
        <div style={{
          filter: `drop-shadow(0 0 ${volume * 30}px rgba(56, 189, 248, ${0.4 + volume * 0.6}))`,
          transition: 'filter 0.1s ease-out'
        }}>
          <Flashcard
            word={currentWord}
            mode={currentMode}
            onAudioPlay={playAudio}
            knownWords={Object.keys(gameState.words).map(id => polishWords.find(w => w.id == id)?.polish).filter(Boolean)}
            attempted={!!feedback}
            audioVolume={audioVolume}
            isRecording={isRecording}
          />
        </div>
      </div>

      <div className="controls">
        <button className="skip-button" onClick={handleGiveUp} title="Mark as Incorrect / Reveal">
          🤷 Don't Know
        </button>

        <button className="known-button" style={{ filter: 'grayscale(1)' }} onClick={handleSuspend} title="Remove from curriculum">
          🚫 Suspend
        </button>

        {currentMode !== 'input' ? (
          <>
            {!feedback || feedback === 'Processing...' || (typeof feedback === 'string' && feedback.startsWith('Error')) || feedback === 'Skipped cycle.' ? (
              <RecordButton
                isRecording={isRecording}
                onRecord={handleRecord}
              />
            ) : (
              <button className="next-button" onClick={handleNext}>
                Next Word ➡️
              </button>
            )}
          </>
        ) : (
          <button className="next-button" onClick={handleNext}>
            Next (Done Listening)
          </button>
        )}
      </div>

      {/* Show Retry button if incorrect. We check for 'Incorrect' text in feedback or just if we have feedback and it's not the 'Success' state (roughly) */}
      {feedback && typeof feedback !== 'string' && feedback.props && feedback.props.children[0].props.children.includes("Incorrect") && (
        <div style={{ marginTop: '1rem' }}>
          {feedback && typeof feedback !== 'string' && feedback.props && feedback.props.children[0].props.children.includes("Incorrect") && (
            <div style={{ marginTop: '1rem' }}>
              <button className="progress-btn" onClick={() => { setFeedback(null); setPendingResult(null); handleRecord(); }}>🔄 Retry / Record Again</button>
            </div>
          )}
        </div>
      )}

      {feedback && (
        <div className="feedback" style={{ position: 'relative' }}>
          {feedback}
          <button
            onClick={() => {
              if (lastResult?.wasCorrect) {
                recordFailure(currentWord.id);
                setFeedback(<div className="main-feedback" style={{ color: 'var(--error-color)' }}>❌ Incorrect (Manual Override)</div>);
                setLastResult({ wasCorrect: false });
              } else {
                recordSuccess(currentWord.id);
                setFeedback(<div className="main-feedback">✅ Correct (Manual Override) <span className="score">+10 XP</span></div>);
                setLastResult({ wasCorrect: true });
                triggerConfetti();
              }
            }}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '8px',
              padding: '4px 8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              opacity: 0.7
            }}
            title="Swap Result (Correct/Incorrect)"
          >
            Swap ⇄
          </button>
        </div>
      )}

      {showLexicon && (
        <Lexicon
          gameState={gameState}
          allWords={polishWords}
          onClose={() => setShowLexicon(false)}
          onReset={resetProgress}
        />
      )}
    </div>
  );
}

export default App;
