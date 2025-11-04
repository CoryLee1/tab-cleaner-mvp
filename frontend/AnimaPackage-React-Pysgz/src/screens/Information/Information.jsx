import React from "react";
import "./style.css";

export const Information = () => {
  return (
    <div className="information">
      <div className="info-card">
        <div className="status-sentence">
          <div className="text-wrapper">您已选择</div>

          <div className="div">网页</div>

          <div className="selected-number">5个</div>
        </div>

        <div className="button-function">
          <div className="text-wrapper">此组命名为</div>

          <div className="rename-string">蓝色参考</div>
        </div>
      </div>

      <div className="frame">
        <div className="delete-button">
          <div className="text-wrapper-2">删除</div>
        </div>

        <div className="name-button">
          <div className="text-wrapper-3">命名分组</div>
        </div>

        <div className="openurl-button">
          <div className="text-wrapper-4">打开</div>
        </div>

        <div className="download-url-button">
          <div className="text-wrapper-5">下载链接</div>
        </div>

        <div className="div-wrapper">
          <div className="text-wrapper-6">AI洞察</div>
        </div>
      </div>
    </div>
  );
};
