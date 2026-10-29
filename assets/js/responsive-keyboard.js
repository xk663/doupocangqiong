/**
 * 键盘管理器: 处理iOS/Android虚拟键盘弹出
 * 关键功能: 检测虚拟键盘弹出/关闭，动态调整UI显示
 */
class KeyboardManager {
  constructor() {
    this.isKeyboardVisible = false;
    this.windowHeight = window.innerHeight;
    this.setupListeners();
    if (typeof console !== "undefined") {
      console.log("[KeyboardManager] 已初始化");
    }
  }

  setupListeners() {
    // 方案1: 监听 input/textarea 的 focus/blur 事件
    document.addEventListener(
      "focus",
      (e) => {
        if (this.isInput(e.target)) {
          this.handleKeyboardShow();
        }
      },
      true
    );

    document.addEventListener(
      "blur",
      (e) => {
        if (this.isInput(e.target)) {
          // 延迟检查，确保 resize 已触发
          setTimeout(() => this.handleKeyboardHide(), 100);
        }
      },
      true
    );

    // 方案2: 监听视口高度变化 (更准确，推荐)
    window.addEventListener("resize", () => {
      const newHeight = window.innerHeight;

      // 高度减少 > 100px 说明虚拟键盘弹出
      if (newHeight < this.windowHeight - 100) {
        this.handleKeyboardShow();
        this.windowHeight = newHeight;
      }
      // 高度恢复说明虚拟键盘关闭
      else if (newHeight > this.windowHeight + 100) {
        this.handleKeyboardHide();
        this.windowHeight = newHeight;
      }
    });
  }

  isInput(target) {
    return target.tagName === "INPUT" || target.tagName === "TEXTAREA";
  }

  handleKeyboardShow() {
    if (this.isKeyboardVisible) return;
    this.isKeyboardVisible = true;

    // 添加标记类, CSS 会自动隐藏非关键UI
    document.body.classList.add("keyboard-active");

    if (typeof console !== "undefined") {
      console.log("[KeyboardManager] 虚拟键盘已弹出");
    }
  }

  handleKeyboardHide() {
    if (!this.isKeyboardVisible) return;
    this.isKeyboardVisible = false;

    // 移除标记类, UI恢复显示
    document.body.classList.remove("keyboard-active");

    if (typeof console !== "undefined") {
      console.log("[KeyboardManager] 虚拟键盘已隐藏");
    }
  }
}

// 在页面加载后初始化
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    window.keyboardManager = new KeyboardManager();
  });
} else {
  window.keyboardManager = new KeyboardManager();
}
