'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const WELCOME =
  'Hello! I am your Hyperframe Video Engineer. I can help you build high-performance, interactive videos using HTML and GSAP. What are we building today?';

export const useHyperframeStudioStore = create(
  persist(
    (set) => ({
      messages: [{ role: 'assistant', content: WELCOME }],
      generatedCode: '',
      showCode: false,
      planFirst: true,
      rightTab: 'code',

      setMessages: (messages) => set({ messages }),
      setGeneratedCode: (generatedCode) => set({ generatedCode }),
      setShowCode: (showCode) => set({ showCode }),
      setPlanFirst: (planFirst) => set({ planFirst }),
      setRightTab: (rightTab) => set({ rightTab }),

      resetWorkspace: () =>
        set({
          messages: [{ role: 'assistant', content: WELCOME }],
          generatedCode: '',
          showCode: false,
          rightTab: 'code',
        }),
    }),
    {
      name: 'opa-hyperframe-studio',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      partialize: (s) => ({
        messages: s.messages,
        generatedCode: s.generatedCode,
        showCode: s.showCode,
        planFirst: s.planFirst,
        rightTab: s.rightTab,
      }),
    },
  ),
);
