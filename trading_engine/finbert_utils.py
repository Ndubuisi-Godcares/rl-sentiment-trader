from transformers import BertTokenizer, BertForSequenceClassification, pipeline
import torch

_cuda = torch.cuda.is_available()
print(f"CUDA available: {_cuda}")
if _cuda:
    print(f"Using device: {torch.cuda.get_device_name(0)}")

finbert   = BertForSequenceClassification.from_pretrained("yiyanghkust/finbert-tone")
tokenizer = BertTokenizer.from_pretrained("yiyanghkust/finbert-tone")

nlp = pipeline(
    "sentiment-analysis",
    model=finbert,
    tokenizer=tokenizer,
    device=0 if _cuda else -1,
)

_LABEL_MAP = {
    "Positive": "positive",
    "Negative": "negative",
    "Neutral":  "neutral",
    "LABEL_0":  "neutral",
    "LABEL_1":  "positive",
    "LABEL_2":  "negative",
}


def estimate_sentiment(news, weights=None):
    """
    news:    list of str  OR  list of dict with 'headline' and optional 'summary'.
             Dicts get headline + summary concatenated for richer FinBERT context.
    weights: optional list of float recency weights (same length as news).
             Higher = more recent. When None all articles are equally weighted.

    Returns (probability, sentiment):
        probability — confidence in the dominant class (0–1)
        sentiment   — 'positive' | 'negative' | 'neutral'
    """
    if not news:
        return 0.0, "neutral"

    # Build texts and align weights in one pass
    texts   = []
    w_final = []
    for idx, item in enumerate(news):
        if isinstance(item, dict):
            headline = item.get("headline", "")
            summary  = item.get("summary", "")
            text = headline
            if summary and len(summary.strip()) > 20:
                text = f"{headline}. {summary[:200]}"
        else:
            text = str(item)
        text = text.strip()
        if not text:
            continue
        texts.append(text)
        if weights is not None and idx < len(weights):
            w_final.append(float(weights[idx]))
        else:
            w_final.append(1.0)

    if not texts:
        return 0.0, "neutral"

    results  = nlp(texts, batch_size=8, truncation=True, max_length=512)
    total_w  = sum(w_final) or 1.0

    # Weighted confidence accumulation per class
    scores = {"positive": 0.0, "negative": 0.0, "neutral": 0.0}
    for result, w in zip(results, w_final):
        label = _LABEL_MAP.get(result["label"], "neutral")
        scores[label] += result["score"] * w

    dominant   = max(scores, key=scores.get)
    confidence = scores[dominant] / total_w

    return float(confidence), dominant
