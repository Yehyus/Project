import yfinance as yf

ticker = yf.Ticker("NQ=F")
data = ticker.history(period="5d", interval="1d")

print(data)
