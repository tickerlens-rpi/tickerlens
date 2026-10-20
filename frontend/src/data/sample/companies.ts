/**
 * @fileoverview The companies the sample client knows about. Same list as the
 * central API's `api/app/sample_data.py`, so search behaves the same with or
 * without the API.
 */

import type {Company} from '../research';

export const SAMPLE_COMPANIES: readonly Company[] = [
  {ticker: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ'},
  {ticker: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ'},
  {ticker: 'APLE', name: 'Apple Hospitality REIT', exchange: 'NYSE'},
  {ticker: 'BRK.B', name: 'Berkshire Hathaway Inc.', exchange: 'NYSE'},
  {ticker: 'DIS', name: 'The Walt Disney Company', exchange: 'NYSE'},
  {ticker: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ'},
  {ticker: 'JPM', name: 'JPMorgan Chase & Co.', exchange: 'NYSE'},
  {ticker: 'KO', name: 'The Coca-Cola Company', exchange: 'NYSE'},
  {ticker: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ'},
  {ticker: 'NKE', name: 'Nike, Inc.', exchange: 'NYSE'},
  {ticker: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ'},
  {ticker: 'SBUX', name: 'Starbucks Corporation', exchange: 'NASDAQ'},
  {ticker: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ'},
  {
    ticker: 'SPCX',
    name: 'Space Exploration Technologies Corp.',
    exchange: 'NASDAQ',
  },
];
