import csv
import json
import os
import time
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
basedir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(basedir, '../.env'))

# Configure Gemini
api_key = os.getenv('VITE_GOOGLE_API_KEY')
if not api_key:
    # Try finding it without VITE_ prefix or just print all keys for debug (careful)
    print("Error: VITE_GOOGLE_API_KEY not found in .env")
    # debug
    # print(os.environ)
    exit(1)

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.0-flash-exp')

def sanitize_word(word):
    return word.strip().replace('"', '').replace("'", "")

def process_batch(words_batch, start_index):
    prompt = """
    You are a Polish-English dictionary expert.
    I will provide a list of Polish words.
    For each word, provide:
    1. The English translation (keep it simple, most common meaning).
    2. A phonetic pronunciation guide for English speakers (e.g., 'chip-skuh' for 'chipsy').
    
    Input list:
    {words}

    Output valid JSON array of objects with keys: 'word', 'english', 'phonetic'.
    Do not use markdown code blocks. Just the raw JSON.
    """
    
    word_list_str = ", ".join([w['word'] for w in words_batch])
    final_prompt = prompt.replace("{words}", word_list_str)
    
    try:
        response = model.generate_content(final_prompt)
        content = response.text.strip()
        # Cleanup if markdown blocks are included
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
            
        data = json.loads(content)
        
        # Add IDs and frequency
        for i, item in enumerate(data):
            original = next((w for w in words_batch if w['word'] == item['word']), None)
            if original:
                item['id'] = original['index']
                item['frequency'] = original['frequency']
            else:
                # Fallback if Gemini mangled the word, try to match by order
                if i < len(words_batch):
                     item['id'] = words_batch[i]['index']
                     item['frequency'] = words_batch[i]['frequency']

        return data
    except Exception as e:
        print(f"Error processing batch: {e}")
        return []

def main():
    input_file = '../polish_frequency_list.csv'
    output_file = 'words_500.json'
    
    words_to_process = []
    
    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        print(f"CSV Headers: {reader.fieldnames}")
        for row in reader:
            if int(row['index']) <= 500: # Limit to top 500
                words_to_process.append(row)
    
    print(f"Found {len(words_to_process)} words to process.")
    
    batch_size = 20
    all_words = []
    
    for i in range(0, len(words_to_process), batch_size):
        batch = words_to_process[i:i+batch_size]
        print(f"Processing batch {i} to {i+batch_size}...")
        results = process_batch(batch, i)
        all_words.extend(results)
        time.sleep(1) # Respect rate limits
        
    print(f"Saving {len(all_words)} words to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_words, f, indent=2, ensure_ascii=False)
    
    print("Done!")

if __name__ == "__main__":
    main()
