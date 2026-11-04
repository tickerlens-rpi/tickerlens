/**
 * @fileoverview Supplies the ResearchClient to the component tree. The app
 * provides the configured client; tests provide the sample client or a fake.
 */

import {createContext, useContext} from 'react';
import {ApiResearchClient} from './api_research_client';
import type {ResearchClient} from './research';
import {SampleResearchClient} from './sample_research_client';

/**
 * Builds the client the app uses: the central API when `apiBaseUrl` is set
 * (VITE_API_BASE_URL), otherwise sample data only.
 */
export function createResearchClient(apiBaseUrl?: string): ResearchClient {
  const sample = new SampleResearchClient();
  const baseUrl = apiBaseUrl?.trim();
  return baseUrl ? new ApiResearchClient(baseUrl, sample) : sample;
}

export const ResearchClientContext = createContext<ResearchClient | undefined>(
  undefined,
);

/** Returns the ResearchClient provided above this component. */
export function useResearchClient(): ResearchClient {
  const client = useContext(ResearchClientContext);
  if (!client) {
    throw new Error('useResearchClient needs a ResearchClientContext above it');
  }
  return client;
}
