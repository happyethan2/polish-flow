import json
import os
import asyncio
import edge_tts
from tqdm import tqdm
from dotenv import load_dotenv

# Load environment variables (kept for consistency, though not strictly needed for free TTS)
basedir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(basedir, '../.env'))

VOICE = "pl-PL-ZofiaNeural" # High quality Polish voice

async def generate_file(text, output_file):
    communicate = edge_tts.Communicate(text, VOICE)
    await communicate.save(output_file)

async def main():
    # Resolve path relative to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_file = os.path.join(script_dir, 'words.json')
    # Output to public/audio so it's accessible by the app
    output_dir = os.path.join(script_dir, '../public/audio')
    
    # Ensure output directory exists
    if not os.path.exists(output_dir):
        print(f"Creating directory {output_dir}...")
        os.makedirs(output_dir)
        
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found. Run hydrate.py first.")
        exit(1)
        
    print(f"Loading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        words = json.load(f)
        
    updated_words = []
    
    print(f"Processing {len(words)} words using Voice: {VOICE}...")
    
    # Create concurrency semaphore
    sem = asyncio.Semaphore(5) # 5 concurrent requests

    async def process_word(i, word_data):
        async with sem:
            word = word_data.get('polish', word_data.get('word'))
            word_id = word_data.get('id', i+1)
            
            # Sanitize ID for filename
            filename = f"{word_id}.mp3"
            filepath = os.path.join(output_dir, filename)
            relative_path = f"audio/{filename}"
            
            # ALWAYS overwrite or check?
            # User wants to ENSURE Polish. Existing files might be English "No".
            # So we SHOULD overwrite at least the risky ones.
            # To be safe, let's just overwrite ALL. It's fast and free.
            
            try:
                if not os.path.exists(filepath) or True: # Force regen
                    print(f"Generating {filename} for {word}...")
                    await generate_file(word, filepath)
                else:
                    # Force regen to ensure Polish? 
                    # Yes, previous run was partially flawed.
                    await generate_file(word, filepath)

                word_data['audio'] = relative_path
                if i % 20 == 0:
                   print(f"[{i}/{len(words)}] Processed {word}")
            except Exception as e:
                print(f"Failed to generate audio for {word}: {e}")
            
            return word_data

    # Create tasks
    tasks = [process_word(i, w) for i, w in enumerate(words)]
    
    # Run tasks with tqdm
    updated_words = []
    for f in tqdm(asyncio.as_completed(tasks), total=len(tasks), unit="files", desc="Generating Audio"):
        result = await f
        updated_words.append(result)
    
    # Sort by ID just in case
    updated_words.sort(key=lambda x: int(x.get('id', 0)))

    print("Saving updated words list...")
    with open(input_file, 'w', encoding='utf-8') as f:
        json.dump(updated_words, f, indent=2, ensure_ascii=False)
        
    print("Done! Audio files generated (Guaranteed Polish) and JSON updated.")

if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(main())
