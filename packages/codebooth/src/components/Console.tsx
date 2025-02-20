import {useStore} from "zustand";
import {useBoothStore} from "../store";

/** Component for displaying console logs. */
export function Console() {
  const store = useBoothStore();
  const messages = useStore(store, state => state.messages);

  return (
    <output className="lqv-console">
      {messages}
    </output>
  );
}
