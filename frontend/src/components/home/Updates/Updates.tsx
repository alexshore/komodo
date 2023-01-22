import { Component, createEffect, createSignal, For, Show } from "solid-js";
import { useAppState } from "../../../state/StateProvider";
import { Operation } from "../../../types";
import Flex from "../../shared/layout/Flex";
import Grid from "../../shared/layout/Grid";
import Loading from "../../shared/loading/Loading";
import Selector from "../../shared/menu/Selector";
import Update from "./Update";

const OPERATIONS = Object.values(Operation)
  .filter((e) => e !== "none" && !e.includes("user"))
  .map((e) => e.replaceAll("_", " "));

const Updates: Component<{}> = () => {
  const { updates } = useAppState();
  const [operation, setOperation] = createSignal<Operation>();
  createEffect(() => {
    if (operation()) {
      updates.load([operation()!]);
    } else {
      updates.load();
    }
  });
  return (
    <Grid class="card shadow" style={{ "flex-grow": 1 }}>
      <Flex alignItems="center" justifyContent="space-between">
        <h1>updates</h1>
        <Selector
          selected={operation() ? operation()! : "all"}
          items={["all", ...OPERATIONS]}
          onSelect={(o) =>
            o === "all"
              ? setOperation(undefined)
              : setOperation(o.replaceAll(" ", "_") as Operation)
          }
          targetStyle={{ padding: "0" }}
          position="bottom right"
          searchStyle={{ width: "15rem" }}
          menuClass="scroller"
          menuStyle={{ "max-height": "50vh" }}
          useSearch
        />
      </Flex>
      <Show
        when={updates.loaded()}
        fallback={
          <Flex justifyContent="center">
            <Loading type="three-dot" />
          </Flex>
        }
      >
        <Grid class="updates-container-small scroller">
          <For each={updates.collection()!}>
            {(update) => <Update update={update} />}
          </For>
          <Show when={!updates.noMore()}>
            <button
              class="grey"
              style={{ width: "100%" }}
              onClick={updates.loadMore}
            >
              load more
            </button>
          </Show>
        </Grid>
      </Show>
    </Grid>
  );
};

export default Updates;
