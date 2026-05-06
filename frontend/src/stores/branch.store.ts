import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BranchState {
  activeBranchId: string;
  setActiveBranchId: (id: string) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      activeBranchId: '',
      setActiveBranchId: (id) => set({ activeBranchId: id }),
    }),
    { name: 'branch-storage' },
  ),
);
