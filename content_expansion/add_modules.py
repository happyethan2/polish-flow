import json
import os
from tqdm import tqdm
import time

filename = 'content_expansion/words.json'

new_data = [
    # Module 13: Nature & Weather
    {"id": 201, "module": 13, "category": "nature", "polish": "słońce", "english": "sun", "phonetic": "swon-tse", "example_sentence": "Słońce świeci.", "example_translation": "The sun is shining."},
    {"id": 202, "module": 13, "category": "nature", "polish": "deszcz", "english": "rain", "phonetic": "deshch", "example_sentence": "Pada deszcz.", "example_translation": "It is raining."},
    {"id": 203, "module": 13, "category": "nature", "polish": "wiatr", "english": "wind", "phonetic": "vyatr", "example_sentence": "Mocny wiatr.", "example_translation": "Strong wind."},
    {"id": 204, "module": 13, "category": "nature", "polish": "śnieg", "english": "snow", "phonetic": "shnyeg", "example_sentence": "Pada śnieg.", "example_translation": "It is snowing."},
    {"id": 205, "module": 13, "category": "nature", "polish": "chmura", "english": "cloud", "phonetic": "hmoo-ra", "example_sentence": "Duża chmura.", "example_translation": "Big cloud."},
    {"id": 206, "module": 13, "category": "nature", "polish": "niebo", "english": "sky", "phonetic": "nye-bo", "example_sentence": "Niebieskie niebo.", "example_translation": "Blue sky."},
    {"id": 207, "module": 13, "category": "nature", "polish": "drzewo", "english": "tree", "phonetic": "dzhe-vo", "example_sentence": "Wysokie drzewo.", "example_translation": "Tall tree."},
    {"id": 208, "module": 13, "category": "nature", "polish": "kwiat", "english": "flower", "phonetic": "kfyat", "example_sentence": "Piękny kwiat.", "example_translation": "Beautiful flower."},
    {"id": 209, "module": 13, "category": "nature", "polish": "rzeka", "english": "river", "phonetic": "zhe-ka", "example_sentence": "Długa rzeka.", "example_translation": "Long river."},
    {"id": 210, "module": 13, "category": "nature", "polish": "morze", "english": "sea", "phonetic": "mo-zhe", "example_sentence": "Lubię morze.", "example_translation": "I like the sea."},
    {"id": 211, "module": 13, "category": "nature", "polish": "góra", "english": "mountain", "phonetic": "goo-ra", "example_sentence": "Wysoka góra.", "example_translation": "High mountain."},
    {"id": 212, "module": 13, "category": "nature", "polish": "las", "english": "forest", "phonetic": "las", "example_sentence": "Ciemny las.", "example_translation": "Dark forest."},
    {"id": 213, "module": 13, "category": "nature", "polish": "ziemia", "english": "earth/ground", "phonetic": "zyem-ya", "example_sentence": "Zimna ziemia.", "example_translation": "Cold ground."},
    {"id": 214, "module": 13, "category": "nature", "polish": "księżyc", "english": "moon", "phonetic": "kshen-zhits", "example_sentence": "Jasny księżyc.", "example_translation": "Bright moon."},
    {"id": 215, "module": 13, "category": "nature", "polish": "gwiazda", "english": "star", "phonetic": "gvyaz-da", "example_sentence": "Widzę gwiazdę.", "example_translation": "I see a star."},
    {"id": 216, "module": 13, "category": "nature", "polish": "pogoda", "english": "weather", "phonetic": "po-go-da", "example_sentence": "Dobra pogoda.", "example_translation": "Good weather."},
    {"id": 217, "module": 13, "category": "nature", "polish": "burza", "english": "storm", "phonetic": "boo-zha", "example_sentence": "Idzie burza.", "example_translation": "Storm is coming."},
    {"id": 218, "module": 13, "category": "nature", "polish": "mgła", "english": "fog", "phonetic": "mgwa", "example_sentence": "Gęsta mgła.", "example_translation": "Thick fog."},
    {"id": 219, "module": 13, "category": "nature", "polish": "lato", "english": "summer", "phonetic": "la-to", "example_sentence": "Ciepłe lato.", "example_translation": "Warm summer."},
    {"id": 220, "module": 13, "category": "nature", "polish": "zima", "english": "winter", "phonetic": "zhee-ma", "example_sentence": "Zimna zima.", "example_translation": "Cold winter."},

    # Module 15: Clothes
    {"id": 221, "module": 15, "category": "clothes", "polish": "ubranie", "english": "clothes", "phonetic": "oo-bra-nye", "example_sentence": "Nowe ubranie.", "example_translation": "New clothes."},
    {"id": 222, "module": 15, "category": "clothes", "polish": "koszulka", "english": "t-shirt", "phonetic": "ko-shool-ka", "example_sentence": "Biała koszulka.", "example_translation": "White t-shirt."},
    {"id": 223, "module": 15, "category": "clothes", "polish": "spodnie", "english": "trousers/pants", "phonetic": "spod-nye", "example_sentence": "Czarne spodnie.", "example_translation": "Black trousers."},
    {"id": 224, "module": 15, "category": "clothes", "polish": "buty", "english": "shoes", "phonetic": "boo-ti", "example_sentence": "Wygodne buty.", "example_translation": "Comfortable shoes."},
    {"id": 225, "module": 15, "category": "clothes", "polish": "kurtka", "english": "jacket", "phonetic": "koort-ka", "example_sentence": "Ciepła kurtka.", "example_translation": "Warm jacket."},
    {"id": 226, "module": 15, "category": "clothes", "polish": "czapka", "english": "hat/cap", "phonetic": "chap-ka", "example_sentence": "Mam czapkę.", "example_translation": "I have a hat."},
    {"id": 227, "module": 15, "category": "clothes", "polish": "sukienka", "english": "dress", "phonetic": "soo-kyen-ka", "example_sentence": "Ładna sukienka.", "example_translation": "Pretty dress."},
    {"id": 228, "module": 15, "category": "clothes", "polish": "spódnica", "english": "skirt", "phonetic": "spood-nee-tsa", "example_sentence": "Krótka spódnica.", "example_translation": "Short skirt."},
    {"id": 229, "module": 15, "category": "clothes", "polish": "sweter", "english": "sweater", "phonetic": "sve-ter", "example_sentence": "Gruby sweter.", "example_translation": "Thick sweater."},
    {"id": 230, "module": 15, "category": "clothes", "polish": "płaszcz", "english": "coat", "phonetic": "pwashch", "example_sentence": "Długi płaszcz.", "example_translation": "Long coat."},
    {"id": 231, "module": 15, "category": "clothes", "polish": "skarpetki", "english": "socks", "phonetic": "skar-pet-kee", "example_sentence": "Czyste skarpetki.", "example_translation": "Clean socks."},
    {"id": 232, "module": 15, "category": "clothes", "polish": "okulary", "english": "glasses", "phonetic": "o-koo-la-ri", "example_sentence": "Noszę okulary.", "example_translation": "I wear glasses."},
    {"id": 233, "module": 15, "category": "clothes", "polish": "zegarek", "english": "watch", "phonetic": "ze-ga-rek", "example_sentence": "Drogi zegarek.", "example_translation": "Expensive watch."},
    {"id": 234, "module": 15, "category": "clothes", "polish": "pasek", "english": "belt", "phonetic": "pa-sek", "example_sentence": "Skórzany pasek.", "example_translation": "Leather belt."},
    {"id": 235, "module": 15, "category": "clothes", "polish": "koszula", "english": "shirt (button)", "phonetic": "ko-shoo-la", "example_sentence": "Elegancka koszula.", "example_translation": "Elegant shirt."},
    {"id": 236, "module": 15, "category": "clothes", "polish": "garnitur", "english": "suit", "phonetic": "gar-nee-toor", "example_sentence": "Nowy garnitur.", "example_translation": "New suit."},
    {"id": 237, "module": 15, "category": "clothes", "polish": "bluza", "english": "sweatshirt", "phonetic": "bloo-za", "example_sentence": "Luźna bluza.", "example_translation": "Loose sweatshirt."},
    {"id": 238, "module": 15, "category": "clothes", "polish": "szalik", "english": "scarf", "phonetic": "sha-leek", "example_sentence": "Ciepły szalik.", "example_translation": "Warm scarf."},
    {"id": 239, "module": 15, "category": "clothes", "polish": "rękawiczki", "english": "gloves", "phonetic": "ren-ka-veech-kee", "example_sentence": "Mam rękawiczki.", "example_translation": "I have gloves."},
    {"id": 240, "module": 15, "category": "clothes", "polish": "prać", "english": "to wash (clothes)", "phonetic": "prach", "example_sentence": "Piorę ubrania.", "example_translation": "I wash clothes."},

    # Module 20: Colors
    {"id": 241, "module": 20, "category": "colors", "polish": "kolor", "english": "color", "phonetic": "ko-lor", "example_sentence": "Jaki kolor?", "example_translation": "What color?"},
    {"id": 242, "module": 20, "category": "colors", "polish": "biały", "english": "white", "phonetic": "bya-wih", "example_sentence": "Biały dom.", "example_translation": "White house."},
    {"id": 243, "module": 20, "category": "colors", "polish": "czarny", "english": "black", "phonetic": "char-nih", "example_sentence": "Czarny kot.", "example_translation": "Black cat."},
    {"id": 244, "module": 20, "category": "colors", "polish": "czerwony", "english": "red", "phonetic": "cher-vo-nih", "example_sentence": "Czerwone auto.", "example_translation": "Red car."},
    {"id": 245, "module": 20, "category": "colors", "polish": "zielony", "english": "green", "phonetic": "zhe-lo-nih", "example_sentence": "Zielone drzewo.", "example_translation": "Green tree."},
    {"id": 246, "module": 20, "category": "colors", "polish": "niebieski", "english": "blue", "phonetic": "nye-byes-kee", "example_sentence": "Niebieskie niebo.", "example_translation": "Blue sky."},
    {"id": 247, "module": 20, "category": "colors", "polish": "żółty", "english": "yellow", "phonetic": "zhool-tih", "example_sentence": "Żółte słońce.", "example_translation": "Yellow sun."},
    {"id": 248, "module": 20, "category": "colors", "polish": "brązowy", "english": "brown", "phonetic": "bron-zo-vih", "example_sentence": "Brązowy stół.", "example_translation": "Brown table."},
    {"id": 249, "module": 20, "category": "colors", "polish": "szary", "english": "gray", "phonetic": "sha-rih", "example_sentence": "Szary dzień.", "example_translation": "Gray day."},
    {"id": 250, "module": 20, "category": "colors", "polish": "różowy", "english": "pink", "phonetic": "roo-zho-vih", "example_sentence": "Różowy kwiat.", "example_translation": "Pink flower."},
    {"id": 251, "module": 20, "category": "colors", "polish": "fioletowy", "english": "purple", "phonetic": "fyo-le-to-vih", "example_sentence": "Fioletowy kolor.", "example_translation": "Purple color."},
    {"id": 252, "module": 20, "category": "colors", "polish": "pomarańczowy", "english": "orange", "phonetic": "po-ma-ran-cho-vih", "example_sentence": "Pomarańczowy owoc.", "example_translation": "Orange fruit."},
    {"id": 253, "module": 21, "category": "verbs", "polish": "pomagać", "english": "to help", "phonetic": "po-ma-gach", "example_sentence": "Pomagam mamie.", "example_translation": "I help mom."},
    {"id": 254, "module": 21, "category": "verbs", "polish": "kochać", "english": "to love", "phonetic": "ko-hach", "example_sentence": "Kocham cię.", "example_translation": "I love you."},
    {"id": 255, "module": 21, "category": "verbs", "polish": "czekać", "english": "to wait", "phonetic": "che-kach", "example_sentence": "Czekam tutaj.", "example_translation": "I am waiting here."},
    {"id": 256, "module": 21, "category": "verbs", "polish": "dzwonić", "english": "to call", "phonetic": "dzvo-neech", "example_sentence": "Dzwonię do szefa.", "example_translation": "I am calling the boss."},
    {"id": 257, "module": 21, "category": "verbs", "polish": "pytać", "english": "to ask", "phonetic": "pi-tach", "example_sentence": "Pytam o drogę.", "example_translation": "I am asking for directions."},
    {"id": 258, "module": 21, "category": "verbs", "polish": "odpowiadać", "english": "to answer", "phonetic": "od-po-vya-dach", "example_sentence": "Odpowiadam na pytanie.", "example_translation": "I am answering the question."},
    {"id": 259, "module": 21, "category": "verbs", "polish": "otwierać", "english": "to open", "phonetic": "ot-fye-rach", "example_sentence": "Otwieram okno.", "example_translation": "I am opening the window."},
    {"id": 260, "module": 21, "category": "verbs", "polish": "zamykać", "english": "to close", "phonetic": "za-mi-kach", "example_sentence": "Zamykam drzwi.", "example_translation": "I am closing the door."},
    {"id": 261, "module": 21, "category": "verbs", "polish": "zaczynać", "english": "to start", "phonetic": "za-chi-nach", "example_sentence": "Zaczynamy pracę.", "example_translation": "We are starting work."},
    {"id": 262, "module": 21, "category": "verbs", "polish": "kończyć", "english": "to finish", "phonetic": "kon-chich", "example_sentence": "Kończę obiad.", "example_translation": "I am finishing lunch."},
    {"id": 263, "module": 21, "category": "verbs", "polish": "pamiętać", "english": "to remember", "phonetic": "pa-myen-tach", "example_sentence": "Pamiętam to.", "example_translation": "I remember that."},
    {"id": 264, "module": 21, "category": "verbs", "polish": "zapomnieć", "english": "to forget", "phonetic": "za-pom-nyech", "example_sentence": "Zapomniałem kluczy.", "example_translation": "I forgot the keys."},
    {"id": 265, "module": 21, "category": "verbs", "polish": "myśleć", "english": "to think", "phonetic": "mish-lech", "example_sentence": "Myślę, że tak.", "example_translation": "I think so."},
    {"id": 266, "module": 21, "category": "verbs", "polish": "uczyć", "english": "to teach/learn", "phonetic": "oo-chich", "example_sentence": "Uczę się polskiego.", "example_translation": "I am learning Polish."},
    {"id": 267, "module": 21, "category": "verbs", "polish": "oglądać", "english": "to watch", "phonetic": "og-lon-dach", "example_sentence": "Oglądam film.", "example_translation": "I am watching a movie."},
    {"id": 268, "module": 21, "category": "verbs", "polish": "słuchać", "english": "to listen", "phonetic": "swoo-hach", "example_sentence": "Słucham muzyki.", "example_translation": "I am listening to music."},
    {"id": 269, "module": 21, "category": "verbs", "polish": "grać", "english": "to play", "phonetic": "grach", "example_sentence": "Gram w piłkę.", "example_translation": "I play ball."},
    {"id": 270, "module": 21, "category": "verbs", "polish": "śpiewać", "english": "to sing", "phonetic": "shpye-vach", "example_sentence": "Lubię śpiewać.", "example_translation": "I like to sing."},
    {"id": 271, "module": 21, "category": "verbs", "polish": "tańczyć", "english": "to dance", "phonetic": "tan-chich", "example_sentence": "Oni tańczą.", "example_translation": "They are dancing."},
    {"id": 272, "module": 21, "category": "verbs", "polish": "podróżować", "english": "to travel", "phonetic": "po-droo-zho-vach", "example_sentence": "Dużo podróżuję.", "example_translation": "I travel a lot."},
    {"id": 273, "module": 21, "category": "verbs", "polish": "gotować", "english": "to cook", "phonetic": "go-to-vach", "example_sentence": "Mama gotuje.", "example_translation": "Mom is cooking."},
    {"id": 274, "module": 21, "category": "verbs", "polish": "sprzątać", "english": "to clean", "phonetic": "spshon-tach", "example_sentence": "Sprzątam dom.", "example_translation": "I am cleaning the house."},
    {"id": 275, "module": 21, "category": "verbs", "polish": "naprawiać", "english": "to fix", "phonetic": "na-pra-vyach", "example_sentence": "Naprawiam auto.", "example_translation": "I am fixing the car."},

    # Module 18: House II (Furniture)
    {"id": 281, "module": 18, "category": "house", "polish": "meble", "english": "furniture", "phonetic": "meb-le", "example_sentence": "Nowe meble.", "example_translation": "New furniture."},
    {"id": 282, "module": 18, "category": "house", "polish": "krzesło", "english": "chair", "phonetic": "kshes-wo", "example_sentence": "Usiądź na krześle.", "example_translation": "Sit on the chair."},
    {"id": 283, "module": 18, "category": "house", "polish": "stół", "english": "table", "phonetic": "stoow", "example_sentence": "Przy stole.", "example_translation": "At the table."},
    {"id": 284, "module": 18, "category": "house", "polish": "łóżko", "english": "bed", "phonetic": "woosh-ko", "example_sentence": "Idę do łóżka.", "example_translation": "I am going to bed."},
    {"id": 285, "module": 18, "category": "house", "polish": "szafa", "english": "wardrobe/closet", "phonetic": "sha-fa", "example_sentence": "Duża szafa.", "example_translation": "Big wardrobe."},
    {"id": 286, "module": 18, "category": "house", "polish": "okno", "english": "window", "phonetic": "ok-no", "example_sentence": "Otwórz okno.", "example_translation": "Open the window."},
    {"id": 287, "module": 18, "category": "house", "polish": "drzwi", "english": "door", "phonetic": "dzhvee", "example_sentence": "Zamknij drzwi.", "example_translation": "Close the door."},
    {"id": 288, "module": 18, "category": "house", "polish": "klucz", "english": "key", "phonetic": "klooch", "example_sentence": "Gdzie jest klucz?", "example_translation": "Where is the key?"},
    {"id": 289, "module": 18, "category": "house", "polish": "podłoga", "english": "floor", "phonetic": "pod-wo-ga", "example_sentence": "Czysta podłoga.", "example_translation": "Clean floor."},
    {"id": 290, "module": 18, "category": "house", "polish": "ściana", "english": "wall", "phonetic": "shcha-na", "example_sentence": "Biała ściana.", "example_translation": "White wall."},
    {"id": 291, "module": 18, "category": "house", "polish": "dach", "english": "roof", "phonetic": "dah", "example_sentence": "Czerwony dach.", "example_translation": "Red roof."},
    {"id": 292, "module": 18, "category": "house", "polish": "ogród", "english": "garden", "phonetic": "og-rood", "example_sentence": "Piękny ogród.", "example_translation": "Beautiful garden."},
    {"id": 293, "module": 18, "category": "house", "polish": "balkon", "english": "balcony", "phonetic": "bal-kon", "example_sentence": "Mały balkon.", "example_translation": "Small balcony."},
    {"id": 294, "module": 18, "category": "house", "polish": "garaż", "english": "garage", "phonetic": "ga-razh", "example_sentence": "Auto w garażu.", "example_translation": "Car in the garage."},
    {"id": 295, "module": 18, "category": "house", "polish": "lampa", "english": "lamp", "phonetic": "lam-pa", "example_sentence": "Włącz lampę.", "example_translation": "Turn on the lamp."},
    {"id": 296, "module": 18, "category": "house", "polish": "dywan", "english": "rug/carpet", "phonetic": "di-van", "example_sentence": "Miękki dywan.", "example_translation": "Soft rug."},
    {"id": 297, "module": 18, "category": "house", "polish": "lustro", "english": "mirror", "phonetic": "loos-tro", "example_sentence": "Duże lustro.", "example_translation": "Big mirror."},
    {"id": 298, "module": 18, "category": "house", "polish": "zegar", "english": "clock", "phonetic": "ze-gar", "example_sentence": "Zegar ścienny.", "example_translation": "Wall clock."},
    {"id": 299, "module": 18, "category": "house", "polish": "obraz", "english": "picture/painting", "phonetic": "ob-raz", "example_sentence": "Ładny obraz.", "example_translation": "Nice picture."},
    {"id": 300, "module": 18, "category": "house", "polish": "telefon", "english": "telephone", "phonetic": "te-le-fon", "example_sentence": "Telefon domowy.", "example_translation": "Home phone."},

    # Module 19: Animals
    {"id": 301, "module": 19, "category": "animals", "polish": "pies", "english": "dog", "phonetic": "pyes", "example_sentence": "To mój pies.", "example_translation": "This is my dog."},
    {"id": 302, "module": 19, "category": "animals", "polish": "kot", "english": "cat", "phonetic": "kot", "example_sentence": "Kot śpi.", "example_translation": "The cat is sleeping."},
    {"id": 303, "module": 19, "category": "animals", "polish": "ptak", "english": "bird", "phonetic": "ptak", "example_sentence": "Ptak śpiewa.", "example_translation": "The bird is singing."},
    {"id": 304, "module": 19, "category": "animals", "polish": "ryba", "english": "fish", "phonetic": "ri-ba", "example_sentence": "Złota ryba.", "example_translation": "Goldfish."},
    {"id": 305, "module": 19, "category": "animals", "polish": "krowa", "english": "cow", "phonetic": "kro-va", "example_sentence": "Krowa daje mleko.", "example_translation": "Cow gives milk."},
    {"id": 306, "module": 19, "category": "animals", "polish": "koń", "english": "horse", "phonetic": "kon", "example_sentence": "Szybki koń.", "example_translation": "Fast horse."},
    {"id": 307, "module": 19, "category": "animals", "polish": "świnia", "english": "pig", "phonetic": "shfee-nya", "example_sentence": "Różowa świnia.", "example_translation": "Pink pig."},
    {"id": 308, "module": 19, "category": "animals", "polish": "kura", "english": "hen", "phonetic": "koo-ra", "example_sentence": "Kura i jajko.", "example_translation": "Hen and egg."},
    {"id": 309, "module": 19, "category": "animals", "polish": "owca", "english": "sheep", "phonetic": "of-tsa", "example_sentence": "Biała owca.", "example_translation": "White sheep."},
    {"id": 310, "module": 19, "category": "animals", "polish": "mysz", "english": "mouse", "phonetic": "mish", "example_sentence": "Mała mysz.", "example_translation": "Small mouse."},
    {"id": 311, "module": 19, "category": "animals", "polish": "niedźwiedź", "english": "bear", "phonetic": "nyedh-vyech", "example_sentence": "Duży niedźwiedź.", "example_translation": "Big bear."},
    {"id": 312, "module": 19, "category": "animals", "polish": "wilk", "english": "wolf", "phonetic": "veelk", "example_sentence": "Szary wilk.", "example_translation": "Gray wolf."},
    {"id": 313, "module": 19, "category": "animals", "polish": "lis", "english": "fox", "phonetic": "lees", "example_sentence": "Sprytny lis.", "example_translation": "Clever fox."},
    {"id": 314, "module": 19, "category": "animals", "polish": "lew", "english": "lion", "phonetic": "lef", "example_sentence": "Król lew.", "example_translation": "King lion."},
    {"id": 315, "module": 19, "category": "animals", "polish": "słoń", "english": "elephant", "phonetic": "swon", "example_sentence": "Wielki słoń.", "example_translation": "Huge elephant."},
    {"id": 316, "module": 19, "category": "animals", "polish": "małpa", "english": "monkey", "phonetic": "maw-pa", "example_sentence": "Wesoła małpa.", "example_translation": "Funny monkey."},
    {"id": 317, "module": 19, "category": "animals", "polish": "pająk", "english": "spider", "phonetic": "pa-yonk", "example_sentence": "Boję się pająka.", "example_translation": "I am afraid of the spider."},
    {"id": 318, "module": 19, "category": "animals", "polish": "osa", "english": "wasp", "phonetic": "o-sa", "example_sentence": "Osa lata.", "example_translation": "Wasp is flying."},
    {"id": 319, "module": 19, "category": "animals", "polish": "mucha", "english": "fly", "phonetic": "moo-ha", "example_sentence": "Natrętna mucha.", "example_translation": "Annoying fly."},
    {"id": 320, "module": 19, "category": "animals", "polish": "zwierzę", "english": "animal", "phonetic": "zvye-zhe", "example_sentence": "To jest zwierzę.", "example_translation": "This is an animal."},

    # Module 22: Prepositions & Adverbs
    {"id": 321, "module": 22, "category": "glue_other", "polish": "w", "english": "in", "phonetic": "v", "example_sentence": "W domu.", "example_translation": "In the house."},
    {"id": 322, "module": 22, "category": "glue_other", "polish": "na", "english": "on/at", "phonetic": "na", "example_sentence": "Na stole.", "example_translation": "On the table."},
    {"id": 323, "module": 22, "category": "glue_other", "polish": "z", "english": "with/from", "phonetic": "z", "example_sentence": "Z mamą.", "example_translation": "With mom."},
    {"id": 324, "module": 22, "category": "glue_other", "polish": "dla", "english": "for", "phonetic": "dla", "example_sentence": "Dla ciebie.", "example_translation": "For you."},
    {"id": 325, "module": 22, "category": "glue_other", "polish": "o", "english": "about", "phonetic": "o", "example_sentence": "O czym myślisz?", "example_translation": "What are you thinking about?"},
    {"id": 326, "module": 22, "category": "glue_other", "polish": "po", "english": "after", "phonetic": "po", "example_sentence": "Po pracy.", "example_translation": "After work."},
    {"id": 327, "module": 22, "category": "glue_other", "polish": "przed", "english": "before/in front of", "phonetic": "pshet", "example_sentence": "Przed domem.", "example_translation": "In front of the house."},
    {"id": 328, "module": 22, "category": "glue_other", "polish": "pod", "english": "under", "phonetic": "pod", "example_sentence": "Pod stołem.", "example_translation": "Under the table."},
    {"id": 329, "module": 22, "category": "glue_other", "polish": "nad", "english": "over/above", "phonetic": "nad", "example_sentence": "Nad rzeką.", "example_translation": "Over the river."},
    {"id": 330, "module": 22, "category": "glue_other", "polish": "bez", "english": "without", "phonetic": "bez", "example_sentence": "Bez cukru.", "example_translation": "Without sugar."},
    {"id": 331, "module": 22, "category": "glue_other", "polish": "dużo", "english": "a lot / much", "phonetic": "doo-zho", "example_sentence": "Dużo pracy.", "example_translation": "A lot of work."},
    {"id": 332, "module": 22, "category": "glue_other", "polish": "mało", "english": "a little / few", "phonetic": "ma-wo", "example_sentence": "Mało czasu.", "example_translation": "Little time."},
    {"id": 333, "module": 22, "category": "glue_other", "polish": "bardzo", "english": "very", "phonetic": "bar-dzo", "example_sentence": "Bardzo dobrze.", "example_translation": "Very good."},
    {"id": 334, "module": 22, "category": "glue_other", "polish": "trochę", "english": "a bit", "phonetic": "tro-he", "example_sentence": "Trochę zimno.", "example_translation": "A bit cold."},
    {"id": 335, "module": 22, "category": "glue_other", "polish": "zawsze", "english": "always", "phonetic": "zaf-she", "example_sentence": "Zawsze rano.", "example_translation": "Always in the morning."},
    {"id": 336, "module": 22, "category": "glue_other", "polish": "nigdy", "english": "never", "phonetic": "neeg-di", "example_sentence": "Nigdy nie mów nigdy.", "example_translation": "Never say never."},
    {"id": 337, "module": 22, "category": "glue_other", "polish": "często", "english": "often", "phonetic": "chen-sto", "example_sentence": "Często biegam.", "example_translation": "I run often."},
    {"id": 338, "module": 22, "category": "glue_other", "polish": "rzadko", "english": "rarely", "phonetic": "zhad-ko", "example_sentence": "Rzadko palę.", "example_translation": "I smoke rarely."},
    {"id": 339, "module": 22, "category": "glue_other", "polish": "teraz", "english": "now", "phonetic": "te-ras", "example_sentence": "Teraz idę.", "example_translation": "I am going now."},
    {"id": 340, "module": 22, "category": "glue_other", "polish": "potem", "english": "later/then", "phonetic": "po-tem", "example_sentence": "Zadzwoń potem.", "example_translation": "Call later."},

    # Module 23: School & Education
    {"id": 341, "module": 23, "category": "school", "polish": "książka", "english": "book", "phonetic": "kshyon-zhka", "example_sentence": "Ciekawa książka.", "example_translation": "Interesting book."},
    {"id": 342, "module": 23, "category": "school", "polish": "zeszyt", "english": "notebook", "phonetic": "ze-shit", "example_sentence": "Mój zeszyt.", "example_translation": "My notebook."},
    {"id": 343, "module": 23, "category": "school", "polish": "długopis", "english": "pen", "phonetic": "dwoo-go-pees", "example_sentence": "Masz długopis?", "example_translation": "Do you have a pen?"},
    {"id": 344, "module": 23, "category": "school", "polish": "ołówek", "english": "pencil", "phonetic": "o-woo-vek", "example_sentence": "Piszę ołówkiem.", "example_translation": "I write with a pencil."},
    {"id": 345, "module": 23, "category": "school", "polish": "uczeń", "english": "student (school)", "phonetic": "oo-chen", "example_sentence": "Dobry uczeń.", "example_translation": "Good student."},
    {"id": 346, "module": 23, "category": "school", "polish": "nauczyciel", "english": "teacher", "phonetic": "now-chi-chel", "example_sentence": "Nasz nauczyciel.", "example_translation": "Our teacher."},
    {"id": 347, "module": 23, "category": "school", "polish": "klasa", "english": "class/classroom", "phonetic": "kla-sa", "example_sentence": "Duża klasa.", "example_translation": "Big classroom."},
    {"id": 348, "module": 23, "category": "school", "polish": "tablica", "english": "blackboard", "phonetic": "tab-lee-tsa", "example_sentence": "Patrz na tablicę.", "example_translation": "Look at the blackboard."},
    {"id": 349, "module": 23, "category": "school", "polish": "lekcja", "english": "lesson", "phonetic": "lek-tsya", "example_sentence": "Koniec lekcji.", "example_translation": "End of lesson."},
    {"id": 350, "module": 23, "category": "school", "polish": "zadanie", "english": "homework/task", "phonetic": "za-da-nye", "example_sentence": "Trudne zadanie.", "example_translation": "Difficult task."},
    # Module 6: Transport
    {"id": 101, "module": 6, "category": "transport", "polish": "bilet", "english": "ticket", "phonetic": "bee-let", "example_sentence": "Proszę bilet.", "example_translation": "Ticket please."},
    {"id": 102, "module": 6, "category": "transport", "polish": "pociąg", "english": "train", "phonetic": "po-chionk", "example_sentence": "Pociąg jedzie.", "example_translation": "Train is coming."},
    {"id": 103, "module": 6, "category": "transport", "polish": "autobus", "english": "bus", "phonetic": "ow-to-boos", "example_sentence": "Jadę autobusem.", "example_translation": "I go by bus."},
    {"id": 104, "module": 6, "category": "transport", "polish": "samochód", "english": "car", "phonetic": "sa-mo-hood", "example_sentence": "Szybki samochód.", "example_translation": "Fast car."},
    {"id": 105, "module": 6, "category": "transport", "polish": "lotnisko", "english": "airport", "phonetic": "lot-nees-ko", "example_sentence": "Jadę na lotnisko.", "example_translation": "I am going to the airport."},
    {"id": 106, "module": 6, "category": "transport", "polish": "dworzec", "english": "station", "phonetic": "dvo-zhets", "example_sentence": "Gdzie jest dworzec?", "example_translation": "Where is the station?"},

    # Module 7: Work
    {"id": 111, "module": 7, "category": "work", "polish": "praca", "english": "work", "phonetic": "pra-tsa", "example_sentence": "Lubię moją pracę.", "example_translation": "I like my work."},
    {"id": 112, "module": 7, "category": "work", "polish": "biuro", "english": "office", "phonetic": "byoo-ro", "example_sentence": "Pracuję w biurze.", "example_translation": "I work in an office."},
    {"id": 113, "module": 7, "category": "work", "polish": "lekarz", "english": "doctor", "phonetic": "le-kash", "example_sentence": "Dobry lekarz.", "example_translation": "Good doctor."},
    {"id": 114, "module": 7, "category": "work", "polish": "nauczyciel", "english": "teacher", "phonetic": "now-chi-chel", "example_sentence": "Jestem nauczycielem.", "example_translation": "I am a teacher."},
    {"id": 115, "module": 7, "category": "work", "polish": "student", "english": "student", "phonetic": "stoo-dent", "example_sentence": "On jest studentem.", "example_translation": "He is a student."},
    {"id": 116, "module": 7, "category": "work", "polish": "pracować", "english": "to work", "phonetic": "pra-tso-vach", "example_sentence": "Oni pracują.", "example_translation": "They are working."},

    # Module 8: Shopping
    {"id": 121, "module": 8, "category": "shopping", "polish": "ile kosztuje", "english": "how much does it cost", "phonetic": "ee-le kosh-too-ye", "example_sentence": "Ile to kosztuje?", "example_translation": "How much does this cost?"},
    {"id": 122, "module": 8, "category": "shopping", "polish": "pieniądze", "english": "money", "phonetic": "pyen-yon-dze", "example_sentence": "Mam pieniądze.", "example_translation": "I have money."},
    {"id": 123, "module": 8, "category": "shopping", "polish": "cena", "english": "price", "phonetic": "tse-na", "example_sentence": "Dobra cena.", "example_translation": "Good price."},
    {"id": 124, "module": 8, "category": "shopping", "polish": "drogi", "english": "expensive", "phonetic": "dro-gee", "example_sentence": "To jest drogie.", "example_translation": "This is expensive."},
    {"id": 125, "module": 8, "category": "shopping", "polish": "tani", "english": "cheap", "phonetic": "ta-nee", "example_sentence": "Tani chleb.", "example_translation": "Cheap bread."},
    {"id": 126, "module": 8, "category": "shopping", "polish": "karta", "english": "card", "phonetic": "kar-ta", "example_sentence": "Płacę kartą.", "example_translation": "I pay by card."},
    {"id": 127, "module": 8, "category": "shopping", "polish": "gotówka", "english": "cash", "phonetic": "go-toóf-ka", "example_sentence": "Mam gotówkę.", "example_translation": "I have cash."},

    # Module 9: Health
    {"id": 131, "module": 9, "category": "health", "polish": "dobrze", "english": "well/good", "phonetic": "dob-zhe", "example_sentence": "Czuję się dobrze.", "example_translation": "I feel good."},
    {"id": 132, "module": 9, "category": "health", "polish": "źle", "english": "badly", "phonetic": "zhle", "example_sentence": "Czuję się źle.", "example_translation": "I feel bad."},
    {"id": 133, "module": 9, "category": "health", "polish": "chory", "english": "sick", "phonetic": "ho-ri", "example_sentence": "Jestem chory.", "example_translation": "I am sick."},
    {"id": 134, "module": 9, "category": "health", "polish": "zdrowy", "english": "healthy", "phonetic": "zdro-vi", "example_sentence": "Zdrowy tryb życia.", "example_translation": "Healthy lifestyle."},
    {"id": 135, "module": 9, "category": "health", "polish": "boleć", "english": "to hurt", "phonetic": "bo-lech", "example_sentence": "Boli mnie głowa.", "example_translation": "My head hurts."},
    {"id": 136, "module": 9, "category": "health", "polish": "pomoc", "english": "help", "phonetic": "po-mots", "example_sentence": "Potrzebuję pomocy.", "example_translation": "I need help."},

    # Module 10: Adjectives
    {"id": 141, "module": 10, "category": "adjectives", "polish": "duży", "english": "big", "phonetic": "doo-zhi", "example_sentence": "Duży dom.", "example_translation": "Big house."},
    {"id": 142, "module": 10, "category": "adjectives", "polish": "mały", "english": "small", "phonetic": "ma-wi", "example_sentence": "Mały kot.", "example_translation": "Small cat."},
    {"id": 143, "module": 10, "category": "adjectives", "polish": "stary", "english": "old", "phonetic": "sta-ri", "example_sentence": "Stary człowiek.", "example_translation": "Old man."},
    {"id": 144, "module": 10, "category": "adjectives", "polish": "nowy", "english": "new", "phonetic": "no-vi", "example_sentence": "Nowy telefon.", "example_translation": "New phone."},
    {"id": 145, "module": 10, "category": "adjectives", "polish": "dobry", "english": "good", "phonetic": "dob-ri", "example_sentence": "Dobry pomysł.", "example_translation": "Good idea."},
    {"id": 146, "module": 10, "category": "adjectives", "polish": "zły", "english": "bad/angry", "phonetic": "zwi", "example_sentence": "Zły pies.", "example_translation": "Bad dog."},
    {"id": 147, "module": 10, "category": "adjectives", "polish": "ładny", "english": "pretty", "phonetic": "wad-ni", "example_sentence": "Ładny kwiat.", "example_translation": "Pretty flower."},
    {"id": 148, "module": 10, "category": "adjectives", "polish": "brzydki", "english": "ugly", "phonetic": "bzhid-ki", "example_sentence": "Brzydki kolor.", "example_translation": "Ugly color."},

    # Defense & Work (Mapped to 'work')
    {"id": 351, "module": 24, "category": "work", "polish": "bezpieczeństwo", "english": "safety/security", "phonetic": "bez-pye-chen-stvo", "example_sentence": "Dbam o bezpieczeństwo.", "example_translation": "I care about safety."},
    {"id": 352, "module": 24, "category": "work", "polish": "system", "english": "system", "phonetic": "sis-tem", "example_sentence": "To nowy system.", "example_translation": "This is a new system."},
    {"id": 353, "module": 24, "category": "work", "polish": "radar", "english": "radar", "phonetic": "ra-dar", "example_sentence": "Radar widzi wszystko.", "example_translation": "The radar sees everything."},
    {"id": 354, "module": 24, "category": "work", "polish": "model", "english": "model", "phonetic": "mo-del", "example_sentence": "To dobry model.", "example_translation": "This is a good model."},
    {"id": 355, "module": 24, "category": "work", "polish": "analiza", "english": "analysis", "phonetic": "a-na-lee-za", "example_sentence": "Dokładna analiza.", "example_translation": "Detailed analysis."},
    {"id": 356, "module": 24, "category": "work", "polish": "inżynier", "english": "engineer", "phonetic": "een-zhi-nyer", "example_sentence": "Jestem inżynierem.", "example_translation": "I am an engineer."},
    {"id": 357, "module": 24, "category": "work", "polish": "plan", "english": "plan", "phonetic": "plan", "example_sentence": "Mamy plan.", "example_translation": "We have a plan."},
    {"id": 358, "module": 24, "category": "work", "polish": "projekt", "english": "project", "phonetic": "pro-yekt", "example_sentence": "Duży projekt.", "example_translation": "Big project."},
    {"id": 359, "module": 24, "category": "work", "polish": "zespół", "english": "team", "phonetic": "zes-poow", "example_sentence": "Nasz zespół.", "example_translation": "Our team."},
    {"id": 360, "module": 24, "category": "work", "polish": "strategia", "english": "strategy", "phonetic": "stra-te-gya", "example_sentence": "Nowa strategia.", "example_translation": "New strategy."},
    {"id": 361, "module": 24, "category": "work", "polish": "cel", "english": "goal/target", "phonetic": "tsel", "example_sentence": "To nasz cel.", "example_translation": "This is our goal."},

    # Keto & Diet (Mapped to 'food')
    {"id": 362, "module": 25, "category": "food", "polish": "energia", "english": "energy", "phonetic": "e-ner-gya", "example_sentence": "Mam dużo energii.", "example_translation": "I have lots of energy."},
    {"id": 363, "module": 25, "category": "food", "polish": "uczucie", "english": "sensation/feeling", "phonetic": "oo-choo-chye", "example_sentence": "Dziwne uczucie.", "example_translation": "Strange sensation."},
    {"id": 364, "module": 25, "category": "food", "polish": "stek", "english": "steak", "phonetic": "stek", "example_sentence": "Lubię steki.", "example_translation": "I like steaks."},
    {"id": 365, "module": 25, "category": "food", "polish": "grill", "english": "grill", "phonetic": "gril", "example_sentence": "Robimy grilla.", "example_translation": "We are having a barbecue."},
    {"id": 366, "module": 25, "category": "food", "polish": "łosoś", "english": "salmon", "phonetic": "wo-sosh", "example_sentence": "Świeży łosoś.", "example_translation": "Fresh salmon."},
    {"id": 367, "module": 25, "category": "food", "polish": "brokuł", "english": "broccoli", "phonetic": "bro-koow", "example_sentence": "Zdrowy brokuł.", "example_translation": "Healthy broccoli."},
    {"id": 368, "module": 25, "category": "food", "polish": "tłuszcz", "english": "fat", "phonetic": "twoshch", "example_sentence": "Zdrowy tłuszcz.", "example_translation": "Healthy fat."},
    {"id": 369, "module": 25, "category": "food", "polish": "białko", "english": "protein", "phonetic": "byaw-ko", "example_sentence": "Dużo białka.", "example_translation": "Lots of protein."},
    {"id": 370, "module": 25, "category": "food", "polish": "awokado", "english": "avocado", "phonetic": "a-vo-ka-do", "example_sentence": "Dojrzałe awokado.", "example_translation": "Ripe avocado."},
    {"id": 371, "module": 25, "category": "food", "polish": "orzechy", "english": "nuts", "phonetic": "o-zhe-hi", "example_sentence": "Lubię orzechy.", "example_translation": "I like nuts."},
    {"id": 372, "module": 25, "category": "food", "polish": "olej", "english": "oil", "phonetic": "o-ley", "example_sentence": "Olej kokosowy.", "example_translation": "Coconut oil."},
    {"id": 373, "module": 25, "category": "food", "polish": "boczek", "english": "bacon", "phonetic": "bo-chek", "example_sentence": "Jajka na boczku.", "example_translation": "Eggs on bacon."},
    {"id": 374, "module": 25, "category": "food", "polish": "masło", "english": "butter", "phonetic": "mas-wo", "example_sentence": "Prawdziwe masło.", "example_translation": "Real butter."},
    {"id": 375, "module": 25, "category": "food", "polish": "dieta", "english": "diet", "phonetic": "dye-ta", "example_sentence": "Dobra dieta.", "example_translation": "Good diet."},

    # Meditation (Mapped to 'health')
    {"id": 376, "module": 26, "category": "health", "polish": "umysł", "english": "mind", "phonetic": "oo-misw", "example_sentence": "Otwarty umysł.", "example_translation": "Open mind."},
    {"id": 377, "module": 26, "category": "health", "polish": "spokój", "english": "calm/peace", "phonetic": "spo-kooy", "example_sentence": "Potrzebuję spokoju.", "example_translation": "I need peace."},
    {"id": 378, "module": 26, "category": "health", "polish": "cisza", "english": "silence", "phonetic": "chee-sha", "example_sentence": "Głęboka cisza.", "example_translation": "Deep silence."},
    {"id": 379, "module": 26, "category": "health", "polish": "oddech", "english": "breath", "phonetic": "od-deh", "example_sentence": "Weź oddech.", "example_translation": "Take a breath."},
    {"id": 380, "module": 26, "category": "health", "polish": "oddychać", "english": "to breathe", "phonetic": "od-di-hach", "example_sentence": "Oddychaj głęboko.", "example_translation": "Breathe deeply."},
    {"id": 381, "module": 26, "category": "health", "polish": "skupienie", "english": "focus", "phonetic": "skoo-pye-nye", "example_sentence": "Pełne skupienie.", "example_translation": "Full focus."},
    {"id": 382, "module": 26, "category": "health", "polish": "dusza", "english": "soul", "phonetic": "doo-sha", "example_sentence": "Ciało i dusza.", "example_translation": "Body and soul."},
    {"id": 383, "module": 26, "category": "health", "polish": "ciało", "english": "body", "phonetic": "cha-wo", "example_sentence": "Zdrowe ciało.", "example_translation": "Healthy body."},

    # Coding & Math (Mapped to 'work' and 'school')
    {"id": 384, "module": 27, "category": "work", "polish": "kod", "english": "code", "phonetic": "kod", "example_sentence": "Piszę kod.", "example_translation": "I write code."},
    {"id": 385, "module": 27, "category": "work", "polish": "program", "english": "program", "phonetic": "pro-gram", "example_sentence": "To działa.", "example_translation": "It works."},
    {"id": 386, "module": 27, "category": "work", "polish": "błąd", "english": "error/bug", "phonetic": "bwont", "example_sentence": "Mały błąd.", "example_translation": "Small bug."},
    {"id": 387, "module": 27, "category": "work", "polish": "ekran", "english": "screen", "phonetic": "e-kran", "example_sentence": "Duży ekran.", "example_translation": "Big screen."},
    {"id": 388, "module": 27, "category": "work", "polish": "klawiatura", "english": "keyboard", "phonetic": "kla-vya-too-ra", "example_sentence": "Nowa klawiatura.", "example_translation": "New keyboard."},
    {"id": 389, "module": 27, "category": "work", "polish": "myszka", "english": "mouse", "phonetic": "mish-ka", "example_sentence": "Myszka bezprzewodowa.", "example_translation": "Wireless mouse."},
    {"id": 390, "module": 27, "category": "school", "polish": "liczba", "english": "number", "phonetic": "leech-ba", "example_sentence": "Jaka to liczba?", "example_translation": "What number is this?"},
    {"id": 391, "module": 27, "category": "school", "polish": "wynik", "english": "result", "phonetic": "vi-neek", "example_sentence": "Dobry wynik.", "example_translation": "Good result."},
    {"id": 392, "module": 27, "category": "school", "polish": "rozwiązanie", "english": "solution", "phonetic": "roz-vion-za-nye", "example_sentence": "Szukam rozwiązania.", "example_translation": "I am looking for a solution."},
    {"id": 393, "module": 27, "category": "school", "polish": "zero", "english": "zero", "phonetic": "ze-ro", "example_sentence": "To jest zero.", "example_translation": "This is zero."},

    # Travel & Nature (Mapped to 'places', 'transport', 'nature')
    {"id": 394, "module": 28, "category": "places", "polish": "hotel", "english": "hotel", "phonetic": "ho-tel", "example_sentence": "Drogi hotel.", "example_translation": "Expensive hotel."},
    {"id": 395, "module": 28, "category": "places", "polish": "rezerwacja", "english": "reservation", "phonetic": "re-zer-va-tsya", "example_sentence": "Mam rezerwację.", "example_translation": "I have a reservation."},
    {"id": 396, "module": 28, "category": "transport", "polish": "lot", "english": "flight", "phonetic": "lot", "example_sentence": "Mój lot.", "example_translation": "My flight."},
    {"id": 397, "module": 28, "category": "transport", "polish": "odlot", "english": "departure", "phonetic": "od-lot", "example_sentence": "Kiedy jest odlot?", "example_translation": "When is the departure?"},
    {"id": 398, "module": 28, "category": "transport", "polish": "przylot", "english": "arrival", "phonetic": "pshi-lot", "example_sentence": "Mam przylot.", "example_translation": "I have an arrival."},
    {"id": 399, "module": 28, "category": "places", "polish": "granica", "english": "border", "phonetic": "gra-nee-tsa", "example_sentence": "Polska granica.", "example_translation": "Polish border."},
    {"id": 400, "module": 28, "category": "places", "polish": "zwiedzać", "english": "to sightsee", "phonetic": "zvye-dzach", "example_sentence": "Lubię zwiedzać.", "example_translation": "I like sightseeing."},
    {"id": 401, "module": 28, "category": "places", "polish": "przewodnik", "english": "guide", "phonetic": "pshe-vod-neek", "example_sentence": "Nasz przewodnik.", "example_translation": "Our guide."},
    {"id": 402, "module": 28, "category": "nature", "polish": "ogień", "english": "fire", "phonetic": "o-gyen", "example_sentence": "Ciepły ogień.", "example_translation": "Warm fire."},

]


def process_in_chunks(data_list, chunk_size=10):
    for i in range(0, len(data_list), chunk_size):
        yield data_list[i:i + chunk_size]

if __name__ == "__main__":
    print(f"Loading {filename}...")
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"File {filename} not found. Creating new...")
        data = []

    # Filter out duplicates by ID
    existing_ids = set(w['id'] for w in data)
    unique_new_data = [w for w in new_data if w['id'] not in existing_ids]

    print(f"DEBUG: Total existing IDs: {len(existing_ids)}")
    print(f"DEBUG: New data count: {len(new_data)}")
    print(f"DEBUG: Unique new data to add: {len(unique_new_data)}")
    
    # If we have 0 unique new data, maybe we should check if they are actually in the file
    if len(unique_new_data) == 0:
         print("DEBUG: Checking specific IDs...")
         for item in new_data[:5]:
             print(f"ID {item['id']} in existing? {item['id'] in existing_ids}")

    if not unique_new_data:
        print("No new modules to add.")
    else:
        print(f"Found {len(unique_new_data)} new items to add.")
        
        # Simulating chunked processing/uploading with feedback
        # Realistically, we just extend the list, but for user feedback we show progress
        # If this was an API upload, chunking is critical. Here it's a file write, but we respect the constraint.
        
        processed_count = 0
        with tqdm(total=len(unique_new_data), unit="word", desc="Adding modules") as pbar:
            for chunk in process_in_chunks(unique_new_data, chunk_size=20):
                data.extend(chunk)
                processed_count += len(chunk)
                pbar.update(len(chunk))
                time.sleep(0.1) # Artifical delay to let user see progress/not hang UI if this was a heavy op

        print("Saving updated file to content_expansion/words.json...")
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        # Sync to app data
        app_data_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../src/data/words.json')
        print(f"Syncing to app data: {app_data_path}...")
        
        # Ensure directory exists just in case
        os.makedirs(os.path.dirname(app_data_path), exist_ok=True)
        
        with open(app_data_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"Successfully added {processed_count} items. Total: {len(data)}")

