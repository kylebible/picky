import { useMenuStore } from "./lib/menuStore";
import { usePath } from "./lib/router";
import { Capture } from "./screens/Capture";
import { DishScreen } from "./screens/DishScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { Picks } from "./screens/Picks";
import { Reading } from "./screens/Reading";
import { SetupAllergies, SetupTastes } from "./screens/Setup";
import { Welcome } from "./screens/Welcome";

export function App() {
  const path = usePath();
  const { menu } = useMenuStore();

  if (path === "/snap") return <Capture />;
  if (path === "/reading") return <Reading />;
  if (path === "/menu") return <MenuScreen />;
  if (path === "/picks") return <Picks />;
  if (path === "/order") return <OrderScreen />;
  if (path === "/setup/allergies") return <SetupAllergies />;
  if (path === "/setup/tastes") return <SetupTastes />;
  const dish = path.match(/^\/dish\/(\d+)$/);
  if (dish) return <DishScreen index={Number(dish[1])} />;
  return menu ? <Picks /> : <Welcome />;
}
