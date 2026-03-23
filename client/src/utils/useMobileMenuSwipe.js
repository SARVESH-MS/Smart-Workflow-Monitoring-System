import { useRef } from "react";

const OPEN_DISTANCE_PX = 72;
const MAX_VERTICAL_DRIFT_PX = 96;

const useMobileMenuSwipe = ({ isOpen, onOpen }) => {
  const startRef = useRef({ x: 0, y: 0, active: false, opened: false });

  const reset = () => {
    startRef.current = { x: 0, y: 0, active: false, opened: false };
  };

  const onTouchStartCapture = (event) => {
    if (isOpen || typeof window === "undefined" || window.innerWidth >= 640) {
      reset();
      return;
    }

    const touch = event.touches?.[0];
    if (!touch) return;

    const startX = touch.clientX;
    const startY = touch.clientY;

    startRef.current = {
      x: startX,
      y: startY,
      active: true,
      opened: false
    };
  };

  const onTouchMoveCapture = (event) => {
    const touch = event.touches?.[0];
    if (!touch || !startRef.current.active || startRef.current.opened) return;

    const deltaX = touch.clientX - startRef.current.x;
    const deltaY = touch.clientY - startRef.current.y;
    const absDeltaY = Math.abs(deltaY);
    const absDeltaX = Math.abs(deltaX);

    if (absDeltaY > MAX_VERTICAL_DRIFT_PX && absDeltaY > absDeltaX) {
      reset();
      return;
    }

    if (deltaX >= OPEN_DISTANCE_PX && absDeltaX > absDeltaY * 1.15) {
      startRef.current.opened = true;
      onOpen();
    }
  };

  const onTouchEndCapture = () => {
    reset();
  };

  return {
    onTouchStartCapture,
    onTouchMoveCapture,
    onTouchEndCapture
  };
};

export default useMobileMenuSwipe;
