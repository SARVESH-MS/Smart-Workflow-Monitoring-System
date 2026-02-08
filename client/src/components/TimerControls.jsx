import React from "react";

const TimerControls = ({ onStart, onStop, onComplete, running }) => (
  <div className="flex flex-wrap gap-2">
    <button className="btn-primary" onClick={onStart} disabled={running}>
      Start
    </button>
    <button className="btn-ghost" onClick={onStop} disabled={!running}>
      Stop
    </button>
    <button className="btn-ghost" onClick={onComplete}>
      Complete
    </button>
  </div>
);

export default TimerControls;
