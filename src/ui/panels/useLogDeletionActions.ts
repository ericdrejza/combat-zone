import { useContext } from "react";
import { useDispatch } from "react-redux";
import { clearChatMessages, deleteChatMessage } from "@store/encounterSlice";
import { resetEncounterLog } from "@store/encounterLogSlice";
import { isPersistenceWritable } from "@store/persistenceWriteGuardMiddleware";
import { PersistenceContext } from "@ui/persistence/PersistenceContext";

/** Delete durable chat independently of history, behind the writer boundary. */
export function useLogDeletionActions() {
  const dispatch = useDispatch();
  const { readOnly } = useContext(PersistenceContext);
  const writable = !readOnly && isPersistenceWritable();
  const canWrite = () => writable && isPersistenceWritable();

  function clearAll() {
    if (!canWrite()) return;
    dispatch(clearChatMessages());
    dispatch(resetEncounterLog());
  }

  function deleteMessage(id: string) {
    if (!canWrite()) return;
    dispatch(deleteChatMessage(id));
  }

  return { clearAll, deleteMessage, writable };
}
