import { useMenuStore } from "./lib/menuStore";
import { usePath } from "./lib/router";
import { Capture } from "./screens/Capture";
import { DishScreen } from "./screens/DishScreen";
import { MenuScreen } from "./screens/MenuScreen";
import { OrderScreen } from "./screens/OrderScreen";
import { Picks } from "./screens/Picks";
import { Reading } from "./screens/Reading";
import { Recent } from "./screens/Recent";
import { SetupAllergies, SetupTastes } from "./screens/Setup";
import { Join, JoinCode, Matches, Share, SplitStart, Swipe } from "./screens/Split";
import { Welcome } from "./screens/Welcome";

export function App() {
  const path = usePath();
  const { menu } = useMenuStore();

  if (path === "/snap") return <Capture />;
  if (path === "/reading") return <Reading />;
  if (path === "/recent") return <Recent />;
  if (path === "/menu") return <MenuScreen />;
  if (path === "/picks") return <Picks />;
  if (path === "/order") return <OrderScreen />;
  if (path === "/split") return <SplitStart />;
  if (path === "/join") return <JoinCode />;
  const split = path.match(/^\/split\/(\d{4})(?:\/(swipe|matches))?$/);
  if (split) {
    const [, code, view] = split;
    if (view === "swipe") return <Swipe code={code} />;
    if (view === "matches") return <Matches code={code} />;
    return <Share code={code} />;
  }
  const join = path.match(/^\/t\/(\d{4})$/);
  if (join) return <Join code={join[1]} />;
  if (path === "/setup/allergies") return <SetupAllergies />;
  if (path === "/setup/tastes") return <SetupTastes />;
  const dish = path.match(/^\/dish\/(\d+)$/);
  if (dish) return <DishScreen index={Number(dish[1])} />;
  return menu ? <Picks /> : <Welcome />;
}
