import {renderHook} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {ApiResearchClient} from './api_research_client';
import {createResearchClient, useResearchClient} from './research_context';
import {SampleResearchClient} from './sample_research_client';

describe('createResearchClient', () => {
  it('uses only sample data when no API address is set', () => {
    expect(createResearchClient()).toBeInstanceOf(SampleResearchClient);
    expect(createResearchClient('   ')).toBeInstanceOf(SampleResearchClient);
  });

  it('uses the API when an address is set', () => {
    expect(createResearchClient('http://localhost:8000')).toBeInstanceOf(
      ApiResearchClient,
    );
  });
});

describe('useResearchClient', () => {
  it('explains what is missing when no client is provided', () => {
    expect(() => renderHook(() => useResearchClient())).toThrow(
      /ResearchClientContext/,
    );
  });
});
