import yfinance as yf

data = yf.download("NQ=F", period="5d", interval="1d")
print(data)
