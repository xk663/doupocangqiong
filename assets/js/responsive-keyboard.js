/** Detect an actual soft-keyboard viewport change, not merely input focus. */
class KeyboardManager {
  constructor() {
    this.isKeyboardVisible=false;
    this.windowWidth=window.innerWidth;
    this.windowHeight=window.innerHeight;
    this.viewportHeight=window.visualViewport?.height||window.innerHeight;
    this.setupListeners();
  }
  setupListeners() {
    document.addEventListener('focus',()=>this.update(),true);
    document.addEventListener('blur',()=>setTimeout(()=>this.update(),100),true);
    window.addEventListener('resize',()=>this.update());
    window.visualViewport?.addEventListener('resize',()=>this.update());
  }
  isInput(target) {
    if(!target||target.disabled||target.readOnly)return false;
    if(target.isContentEditable||target.tagName==='TEXTAREA')return true;
    return target.tagName==='INPUT'&&!['button','submit','reset','checkbox','radio','range','color','file','hidden'].includes(target.type);
  }
  update() {
    const height=window.innerHeight,width=window.innerWidth,viewport=window.visualViewport,vh=viewport?.height||height;
    if(Math.abs(width-this.windowWidth)>80){this.windowWidth=width;this.windowHeight=height;this.viewportHeight=vh;this.handleKeyboardHide();return;}
    const editable=this.isInput(document.activeElement),touch=window.matchMedia?.('(any-pointer: coarse)').matches||window.navigator?.maxTouchPoints>0,wasVisible=this.isKeyboardVisible;
    if(!editable||!touch||(viewport?.scale||1)!==1){
      this.handleKeyboardHide();
      if(!wasVisible){this.windowHeight=height;this.viewportHeight=vh;}
      return;
    }
    const threshold=Math.max(100,this.windowHeight*.15),inset=height-vh-(viewport?.offsetTop||0);
    if(Math.max(inset,this.windowHeight-height,this.viewportHeight-vh)>threshold)this.handleKeyboardShow();else this.handleKeyboardHide();
  }
  handleKeyboardShow() {this.isKeyboardVisible=true;document.body.classList.add('keyboard-active');}
  handleKeyboardHide() {this.isKeyboardVisible=false;document.body.classList.remove('keyboard-active');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{window.keyboardManager=new KeyboardManager();});
else window.keyboardManager=new KeyboardManager();
