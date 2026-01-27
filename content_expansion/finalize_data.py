import json
import os

def main():
    input_file = 'words_500.json'
    output_file = '../src/data/words.json'
    
    print(f"Reading {input_file}...")
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        exit(1)
        
    final_data = []
    
    print(f"Transforming {len(raw_data)} items...")
    
    for item in raw_data:
        # Transform keys to match App expectations
        new_item = {
            "id": int(item.get('id', 0)),
            "polish": item.get('word', ''),
            "english": item.get('english', ''),
            "phonetic": item.get('phonetic', ''),
            "audio_cache_url": item.get('audio', '')
        }
        
        # Validation
        if not new_item['polish']:
            print(f"Warning: Item missing polish word: {item}")
            continue
            
        final_data.append(new_item)
        
    final_data.sort(key=lambda x: x['id'])
    
    print(f"Saving {len(final_data)} items to {output_file}...")
    
    # Backup existing
    if os.path.exists(output_file):
        os.replace(output_file, output_file + '.bak')
        print(f"Backed up old words.json to {output_file}.bak")
        
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        
    print("Done! Data finalized and deployed.")

if __name__ == "__main__":
    main()
