
import os
import time
import base64
import glob
from dotenv import load_dotenv
import google.generativeai as genai
import sys

# Load environment variables (from project root)
load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))

API_KEY = os.getenv("VITE_GOOGLE_API_KEY")
if not API_KEY:
    print("Error: VITE_GOOGLE_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=API_KEY)

print("Initializing Gemini 3 Flash Preview...")

try:
    model = genai.GenerativeModel(
        model_name="gemini-3-flash-preview", 
        system_instruction={
            "parts": [{ "text": "You are a dedicated Polish phonetic transcriber. You are incapable of understanding English. Map ALL audio input to the nearest corresponding Polish phonemes/spelling. If a sound is ambiguous, assume the Polish interpretation." }],
        },
        generation_config={
            "max_output_tokens": 400,
            "temperature": 0.6,
            "top_p": 1,
            "top_k": 1,
        }
    )
except Exception as e:
    print(f"Failed to init model: {e}")
    exit(1)


def generate_with_retry(prompt_parts, retries=3):
    for i in range(retries):
        try:
            # Added explicit timeout of 30 seconds to prevent hanging
            return model.generate_content(prompt_parts, request_options={'timeout': 30})
        except Exception as e:
            if "503" in str(e) or "429" in str(e):
                delay = 2 ** i
                print(f"Server busy (503/429), retrying in {delay}s...")
                time.sleep(delay)
            else:
                return None
    return None

def analyze_file(filepath, target_word):
    try:
        if not os.path.exists(filepath):
            return "FILE_NOT_FOUND;ERROR;0.0"

        with open(filepath, "rb") as f:
            audio_data = f.read()
            if len(audio_data) == 0:
                 return "EMPTY_FILE;ERROR;0.0"
        
        mime_type = "audio/wav" if filepath.endswith(".wav") else "audio/webm"
        
        prompt = f"""
      Target Word: "{target_word}"

      Task: Transcribe the audio using strict Polish phonology and verify against the Target.

      Output Format: HEARD_PHRASE;STATUS;CONFIDENCE

      Rules:
      1. HEARD_PHRASE: Transcribe what you hear using Polish spelling (e.g., If you hear the sound 'bitch', write 'być'.).
      2. STATUS: 
        - "CORRECT" only if the HEARD_PHRASE matches the Target Word (allowing for minor accent deviations).
        - "INCORRECT" for any mismatch.
      3. CONFIDENCE: 0.0-1.0 score.
      """

        response = generate_with_retry([
            prompt,
            {"mime_type": mime_type, "data": audio_data}
        ])

        if response and response.text:
            return response.text.strip()
        else:
            return "NO_RESPONSE;ERROR;0.0"
            
    except Exception as e:
        return f"EXCEPTION;{str(e)[:50]};0.0"

def run_benchmark():
    base_dir = os.path.join(os.path.dirname(__file__), "recordings")
    if not os.path.exists(base_dir):
        print(f"Error: Directory not found: {base_dir}")
        return

    words = [d for d in os.listdir(base_dir) if os.path.isdir(os.path.join(base_dir, d))]
    
    tasks = []
    print("Scanning files...")
    for word in words:
        word_dir = os.path.join(base_dir, word)
        for case_type in ["correct", "wrong", "english"]:
            for fmt in ["wav", "webm"]:
                filepath = os.path.join(word_dir, f"{case_type}.{fmt}")
                if os.path.exists(filepath):
                    tasks.append((word, case_type, fmt, filepath))

    total_files = len(tasks)
    if total_files == 0:
        print("No files found to benchmark.")
        return

    print(f"Found {total_files} files. Starting benchmark using [gemini-3-flash-preview]...")
    print("-" * 80)
    print(f"{'Idx':<4} {'Word':<15} {'Type':<10} {'Fmt':<5} {'Heard':<20} {'Status':<10} {'Conf':<5}")
    print("-" * 80)

    # Force flush to ensure user sees this immediately
    sys.stdout.flush()

    completed = 0
    for i, (word, case_type, fmt, filepath) in enumerate(tasks):
        output = analyze_file(filepath, word)
        
        parts = output.split(";")
        if len(parts) >= 3:
            heard, status, conf = parts[0], parts[1], parts[2]
        else:
            heard, status, conf = output[:20], "ERR", "0"

        heard = heard.strip().replace('\n', ' ')
        status = status.strip().upper()
        conf = conf.strip()

        print(f"{i+1:<4} {word:<15} {case_type:<10} {fmt:<5} {heard:<20} {status:<10} {conf:<5}")
        sys.stdout.flush() # CRITICAL: Ensure every line is printed immediately
        
        time.sleep(0.5) 

    print("-" * 80)
    print("Benchmark Complete.")

if __name__ == "__main__":
    run_benchmark()
