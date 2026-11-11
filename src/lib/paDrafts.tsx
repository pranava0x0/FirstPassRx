import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  type SetStateAction,
  type Dispatch,
} from 'react'
import type { PaRequestInput } from './paRequest'

type Drafts = Map<string, PaRequestInput>
const Context = createContext<[Drafts, Dispatch<SetStateAction<Drafts>>] | null>(null)

// Tab memory only. Closing the tab, reloading, or clearing the worksheet removes its answers.
export function PaDraftProvider({ children }: { children: ReactNode }) {
  const value = useState<Drafts>(() => new Map())
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function usePaDraft(key: string, empty: () => PaRequestInput) {
  const shared = useContext(Context)
  const [local, setLocal] = useState(empty)
  if (!shared) return [local, setLocal, () => setLocal(empty())] as const
  const [drafts, update] = shared
  const set = (action: SetStateAction<PaRequestInput>) =>
    update((prev) => {
      const next = new Map(prev)
      next.set(key, typeof action === 'function' ? action(prev.get(key) ?? empty()) : action)
      return next
    })
  const clear = () =>
    update((prev) => {
      const next = new Map(prev)
      next.delete(key)
      return next
    })
  return [drafts.get(key) ?? empty(), set, clear] as const
}
