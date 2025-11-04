/*
We're constantly improving the code you see. 
Please share your feedback here: https://form.asana.com/?k=uvp-HPgd3_hyoXRBw1IcNg&d=1152665201300829
*/

import PropTypes from "prop-types";
import React from "react";
import { useReducer } from "react";
import { getImageUrl, getAssetUrl } from "../../shared/utils";
import "./style.css";

// 在组件加载时设置 CSS 变量
if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
  const unionSvgUrl = chrome.runtime.getURL('static/img/union-2.svg');
  document.documentElement.style.setProperty('--union-bg-url', `url(${unionSvgUrl})`);
}

export const Component = ({ property1, className }) => {
  const [state, dispatch] = useReducer(reducer, {
    property1: property1 || "sidebar-open",
  });

  return (
    <div
      className={`component ${state.property1} ${className}`}
      onMouseLeave={() => {
        dispatch("mouse_leave");
      }}
      onMouseEnter={() => {
        dispatch("mouse_enter");
      }}
    >
      {state.property1 === "sidebar-open" && (
        <>
          <div className="frame">
            <img className="image" alt="Image" src={getImageUrl("image-128-1.png")} />

            <div className="text-wrapper">XX 的洗衣房</div>

            <div className="div">􀆉</div>
          </div>

          <div className="frame-2">
            <div className="text-wrapper-2"></div>

            <div className="text-wrapper-3">浏览器宠物</div>
          </div>

          <div className="frame-3">
            <div className="text-wrapper-4">􀎞&nbsp;&nbsp; 工作区</div>

            <div className="text-wrapper-5">􀄬</div>

            <div className="text-wrapper-5">􀅼</div>
          </div>

          <div className="frame-4">
            <div className="frame-5">
              <img className="img" alt="Image" src={getImageUrl("image-131-1.png")} />

              <div className="text-wrapper-6">常用收藏</div>
            </div>

            <div className="frame-5">
              <img className="image-2" alt="Image" src={getImageUrl("image-133-1.png")} />

              <div className="text-wrapper-7">隐私</div>
            </div>

            <div className="frame-6">
              <img className="image-3" alt="Image" src={getImageUrl("image-130-2.png")} />

              <div className="text-wrapper-8">我的收藏</div>
            </div>

            <div className="frame-5">
              <img className="image-3" alt="Image" src={getImageUrl("image-130-3.png")} />

              <div className="text-wrapper-7">我的收藏</div>
            </div>

            <div className="frame-5">
              <img className="image-3" alt="Image" src={getImageUrl("image-130-3.png")} />

              <div className="text-wrapper-7">我的收藏</div>
            </div>

            <div className="frame-5">
              <img className="image-3" alt="Image" src={getImageUrl("image-130-3.png")} />

              <div className="text-wrapper-7">我的收藏</div>
            </div>

            <div className="frame-5">
              <img className="image-3" alt="Image" src={getImageUrl("image-130-3.png")} />

              <div className="text-wrapper-7">我的收藏</div>
            </div>
          </div>

          <div className="frame-7">
            <div className="text-wrapper-9">􀅍</div>

            <div className="text-wrapper-10">FAQ</div>
          </div>

          <div className="frame-7">
            <img className="image-4" alt="Image" src={getImageUrl("image-136-1.png")} />

            <div className="text-wrapper-10">升级套餐</div>
          </div>

          <div className="frame-8">
            <div className="div-wrapper">
              <div className="text-wrapper-11">􀉭</div>
            </div>

            <div className="frame-9">
              <div className="text-wrapper-12">Pro Plan</div>

              <div className="text-wrapper-13">元泉</div>

              <div className="text-wrapper-14">liyihua@xiaohongshu.com</div>
            </div>
          </div>
        </>
      )}

      {state.property1 === "one" && (
        <>
          <img className="vector" alt="Vector" src={getImageUrl("vector-649-2.svg")} />

          <img className="vector-2" alt="Vector" src={getImageUrl("vector-649-2.svg")} />

          <img className="vector-3" alt="Vector" src={getImageUrl("vector-649-2.svg")} />
        </>
      )}
    </div>
  );
};

function reducer(state, action) {
  switch (action) {
    case "mouse_leave":
      return {
        ...state,
        property1: "one",
      };

    case "mouse_enter":
      return {
        ...state,
        property1: "sidebar-open",
      };
  }

  return state;
}

Component.propTypes = {
  property1: PropTypes.oneOf(["sidebar-open", "one"]),
};
