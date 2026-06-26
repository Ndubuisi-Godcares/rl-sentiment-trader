import pandas as pd
import requests
from transformers import BertTokenizer, BertForSequenceClassification
import torch
import warnings
from dotenv import load_dotenv
import os

load_dotenv()

warnings.simplefilter("ignore")

# Load the FinBERT model and tokenizer
tokenizer = BertTokenizer.from_pretrained('yiyanghkust/finbert-tone')
model = BertForSequenceClassification.from_pretrained('yiyanghkust/finbert-tone')

# Alpaca News API credentials — loaded from .env (API_KEY, API_SECRET, BASE_URL)
api_key = os.getenv("API_KEY")
api_secret = os.getenv("API_SECRET")
base_url = os.getenv("BASE_URL")

# Alpaca news endpoint lives on the data subdomain, not the broker base_url
news_url = "https://data.alpaca.markets/v1beta1/news"

# Function to fetch historical news articles from Alpaca
def fetch_news_articles(symbol, start_date, end_date):
    headers = {
        'APCA-API-KEY-ID': api_key,
        'APCA-API-SECRET-KEY': api_secret,
        'accept': 'application/json'
    }

    params = {
        'symbols': symbol,
        'start': start_date,
        'end': end_date,
        'sort': 'desc'  # Sorting the news in descending order
    }

    response = requests.get(news_url, headers=headers, params=params)

    if response.status_code == 200:
        data = response.json()
        articles = [article['headline'] for article in data['news']]
        return articles
    else:
        print(f"Error fetching news articles: {response.status_code}, {response.text}")
        return []

# Function to classify sentiment
def classify_sentiment(article):
    inputs = tokenizer(article, return_tensors='pt', truncation=True, padding=True, max_length=512)
    with torch.no_grad():
        outputs = model(**inputs)

    predicted_class = torch.argmax(outputs.logits, dim=1).item()

    if predicted_class == 0:  # Positive
        sentiment = 'positive'
        probability = outputs.logits.softmax(dim=1)[0][0].item()
        impact_score = probability  # Impact score for positive
    elif predicted_class == 1:  # Negative
        sentiment = 'negative'
        probability = outputs.logits.softmax(dim=1)[0][1].item()
        impact_score = -probability  # Impact score for negative
    else:  # Neutral
        sentiment = 'neutral'
        probability = outputs.logits.softmax(dim=1)[0][2].item()
        impact_score = 0  # No impact for neutral

    return sentiment, probability, impact_score

# Parameters for fetching news articles
symbol = 'SPY'  # SPY Symbol
start_date = '2020-01-01'  # Start date in YYYY-MM-DD format
end_date = '2024-07-31'    # End date in YYYY-MM-DD format

# Fetch news articles
news_articles = fetch_news_articles(symbol, start_date, end_date)

# Create a DataFrame from the fetched articles
news_df = pd.DataFrame(news_articles, columns=['article'])

# Classify sentiment for each news article
news_df['sentiment'], news_df['probability'], news_df['impact_score'] = zip(*news_df['article'].apply(classify_sentiment))

# Display the results
print(news_df[['article', 'sentiment', 'probability', 'impact_score']])
