import { Component } from ".";

export default {
  title: "Components/Component",
  component: Component,

  argTypes: {
    property1: {
      options: ["sidebar-open", "one"],
      control: { type: "select" },
    },
  },
};

export const Default = {
  args: {
    property1: "sidebar-open",
    className: {},
  },
};
