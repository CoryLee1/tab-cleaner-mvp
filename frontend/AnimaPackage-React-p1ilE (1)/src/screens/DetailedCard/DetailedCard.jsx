import React from "react";
import "./style.css";

export const DetailedCard = () => {
  return (
    <div className="detailed-card">
      <div className="last-and-next">
        <div className="text-wrapper">􀆉</div>

        <div className="text-wrapper">􀆊</div>
      </div>

      <img
        className="opengraphimage"
        alt="Opengraphimage"
        src="/img/opengraph-image.png"
      />

      <div className="OG-content">
        <div className="OG-title">
          <div className="title">
            <div className="rectangle" />

            <div className="div">Title：</div>
          </div>

          <div className="content">
            <div className="titlecontent">
              👨40+叔叔｜🪭cnyootd｜💰过年就要穿点红的 - 小红书
            </div>
          </div>
        </div>

        <div className="OG-description">
          <div className="description-title">
            <div className="text-wrapper-2">Description：</div>
          </div>

          <div className="describe-content">
            <div className="description">
              &#34;3 亿人的生活经验，都在小红书&#34;
            </div>
          </div>
        </div>

        <div className="OG-URL">
          <div className="rectangle-2" />

          <div className="group">
            <a
              className="text-wrapper-3"
              href="http://xhslink.com/o/7uOhpx73HUT"
              rel="noopener noreferrer"
              target="_blank"
            >
              Link
            </a>

            <div className="rectangle-3" />

            <div className="text-wrapper-4">URL：</div>
          </div>

          <div className="URL">
            <div className="text-wrapper-5">􀉣</div>
          </div>
        </div>
      </div>

      <img className="favicon" alt="Favicon" src="/img/favicon.png" />

      <div className="close-button">􀁠</div>
    </div>
  );
};
