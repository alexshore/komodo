import { Component } from "solid-js";
import { combineClasses } from "../../../../util/helpers";
import Input from "../../../shared/Input";
import Flex from "../../../shared/layout/Flex";
import { useConfig } from "./Provider";

const Address: Component<{}> = (p) => {
  const { server, setServer } = useConfig();
  return (
    <Flex
      class={combineClasses("config-item shadow")}
      justifyContent="space-between"
    >
      <h1>address</h1>
      <Input
        value={server.address}
        placeholder="address"
        onEdit={(value) => setServer("address", value)}
      />
    </Flex>
  );
};

export default Address;
