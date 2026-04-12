import React from "react";
import ReactDOM from "react-dom/client";

import { Widget } from "./Widget";
import "./index.css";

// Dev mode: render widget directly
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Widget
        workflowsApiUrl="http://localhost:3004"
        workspaceId="ws_dev"
        userId="user_dev"
        onComplete={(status) => console.log("Widget complete:", status)}
      />
    </div>
  </React.StrictMode>,
);
