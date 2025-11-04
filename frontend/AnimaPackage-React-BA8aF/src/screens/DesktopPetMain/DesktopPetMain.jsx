import React from "react";
import "./style.css";

export const DesktopPetMain = () => {
  return (
    <div className="desktop-pet-main">
      <div className="pet-main">
        <img className="props" alt="Props" src="/img/props.svg" />

        <div className="avatar" />

        <div className="chat-bubble">
          <div className="div">
            <img
              className="chatbubble-bg"
              alt="Chatbubble bg"
              src="/img/chatbubble-bg.png"
            />

            <div className="rectangle" />

            <div className="emoji-status">💦</div>
          </div>
        </div>
      </div>

      <div className="choice-overlay">
        <div className="hide-button">
          <div className="text-wrapper">隐藏</div>

          <div className="ellipse" />

          <div className="text-wrapper-2"></div>

          <img className="vector" alt="Vector" src="/img/vector-665.svg" />
        </div>

        <div className="setting-button">
          <div className="text-wrapper-3">桌宠设置</div>

          <div className="ellipse-2" />

          <div className="text-wrapper-4"></div>
        </div>

        <div className="clean-current-button">
          <div className="ellipse-3" />

          <div className="text-wrapper-5">清理当前页Tab</div>

          <div className="text-wrapper-6"></div>
        </div>

        <div className="clean-inoneclick">
          <div className="ellipse-4" />

          <div className="text-wrapper-7">一键清理</div>

          <div className="text-wrapper-8"></div>

          <div className="text-wrapper-9"></div>

          <div className="text-wrapper-10"></div>
        </div>
      </div>
    </div>
  );
};
