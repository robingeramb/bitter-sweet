import { useVariablesStore, useShoppingCartStore } from "~/stores/store";

export function useRetry() {
  const variablesStore = useVariablesStore();
  const shoppingCartStore = useShoppingCartStore();

  const handleRetry = () => {
    variablesStore.updateIsSecondPlaythrough(true);

    shoppingCartStore.clearCart();
    variablesStore.updateShowInnerBody(false); 
    variablesStore.updateShoppingDone(false);
    variablesStore.updateCashoutStart(false);
    variablesStore.updateCashoutFinished(false);
    variablesStore.updateShowReceiptDone(false);
    variablesStore.updatePlayerMotion(true);
  };

  return { handleRetry };
}