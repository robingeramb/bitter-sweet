import { useVariablesStore, useShoppingCartStore } from "~/stores/store";
import { cleanupCheckoutLogic } from "@/composables/cashRegister";

export function useRetry() {
  const variablesStore = useVariablesStore();
  const shoppingCartStore = useShoppingCartStore();

  const handleRetry = () => {
    cleanupCheckoutLogic();
    variablesStore.updateIsSecondPlaythrough(true);
    console.log("handleRetry222");
    shoppingCartStore.clearCart();
    variablesStore.updateShowInnerBody(false);
    variablesStore.updateShoppingDone(false);
    variablesStore.updateCashoutStart(false);
    variablesStore.updateCashoutFinished(false);
    variablesStore.updateShowReceiptDone(false);
    variablesStore.updatePlayerMotion(true);
    variablesStore.updateCursorFree(false);
    variablesStore.updateMouthOpen(false);
    variablesStore.updateShowTeeth(false);
  };

  return { handleRetry };
}
