/* The approved local title animation. Stops completely outside the title view. */
(function () {
  'use strict';
  function init() {
    var root = document.getElementById('view-title');
    if (!root || root.querySelector('.title-motion-scene')) return;
    var scene = document.createElement('div');
    scene.className = 'title-motion-scene';
    scene.setAttribute('aria-hidden', 'true');
    scene.innerHTML = '<img class="title-motion-art" src="assets/images/title-gu-reunion.png?v=7" alt=""><canvas class="title-motion-render"></canvas><div class="title-motion-sun"></div><div class="title-motion-mist far"></div><div class="title-motion-mist"></div><canvas class="title-motion-petals"></canvas>';
    root.prepend(scene);
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'title-motion-toggle';
    toggle.setAttribute('aria-label', '暂停主界面动态');
    root.querySelector('.landing-footer').append(toggle);
    var image = scene.querySelector('img');
    var canvas = scene.querySelector('.title-motion-petals');
    var surface = scene.querySelector('.title-motion-render');
    var ctx = canvas.getContext('2d');
    if (!ctx) { scene.remove(); toggle.remove(); return; }
    var reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var paused = reduced.matches, active = false, raf = null, last = null, time = 0;
    var w = 1, h = 1, targetX = 0, targetY = 0, mouseX = 0, mouseY = 0;
    var gl = null, renderer = null;
    var petals = Array.from({length:17}, function (_, i) {
      var layer = i < 10 ? 0 : i < 15 ? 1 : 2;
      return {phase:i*2.39996, offset:(i*.61803398875)%1, lane:(i*.381966)%1, layer:layer,
        period:layer===0?30+i%7:layer===1?23+i%5:18+i%4, size:layer===0?3+i%2:layer===1?5+i%3:9+i%3};
    });
    function resize() {
      var rect = root.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      w = rect.width; h = rect.height;
      var d = Math.min(window.devicePixelRatio || 1, 1.5);
      [canvas, surface].forEach(function (c) { c.width = Math.round(w*d); c.height = Math.round(h*d); });
      ctx.setTransform(d,0,0,d,0,0);
      if (gl) gl.viewport(0,0,surface.width,surface.height);
    }
    function initRenderer() {
      if (!image.naturalWidth) return;
      try {
        gl = surface.getContext('webgl', {alpha:false, antialias:false, powerPreference:'low-power'});
        if (!gl) return;
        function compile(type, source) {
          var shader = gl.createShader(type);
          gl.shaderSource(shader, source); gl.compileShader(shader);
          if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('Title shader unavailable');
          return shader;
        }
        var vertex = compile(gl.VERTEX_SHADER, 'attribute vec2 p;varying vec2 v;void main(){v=vec2(p.x*.5+.5,.5-p.y*.5);gl_Position=vec4(p,0.,1.);}');
        var fragment = compile(gl.FRAGMENT_SHADER, `precision mediump float;
varying vec2 v;uniform sampler2D image;uniform float t;uniform vec2 ratio;uniform vec2 mouse;
float spot(vec2 p,vec2 mid,vec2 size){vec2 d=(p-mid)/size;return exp(-dot(d,d)*2.8);}
void main(){vec2 uv=v;float ar=ratio.x/ratio.y;float ia=1.77665;
if(ar>ia){uv.y=(uv.y-.5)*ia/ar+.5;}else{uv.x=(uv.x-.5)*ar/ia+.5;if(ratio.x<=700.)uv.x+=.28*(1.-ar/ia);}
uv=(uv-.5)/(1.035+.009*sin(t*.14))+.5;
uv+=mouse*vec2(.007,.004)+vec2(sin(t*.10)*.002,cos(t*.12)*.001);
float cloth=spot(uv,vec2(.89,.88),vec2(.16,.22));float hair=spot(uv,vec2(.91,.45),vec2(.13,.17));float ribbon=spot(uv,vec2(.53,.18),vec2(.045,.07));
float face=spot(uv,vec2(.60,.22),vec2(.055,.09))+spot(uv,vec2(.755,.29),vec2(.05,.08));float hand=spot(uv,vec2(.687,.745),vec2(.055,.065));float guard=1.-clamp(face+hand,0.,1.);
uv.x+=guard*(cloth*.0016*sin(t*1.15+uv.y*15.)+hair*.0015*sin(t*1.3+uv.x*22.)+ribbon*.0014*sin(t*1.5));uv.y+=guard*cloth*.0008*sin(t*1.2+uv.x*17.);
float falls=spot(uv,vec2(.137,.61),vec2(.022,.14))+spot(uv,vec2(.252,.675),vec2(.018,.09));uv.y+=falls*.003*sin(t*2.3+uv.y*66.);
vec3 col=texture2D(image,clamp(uv,.001,.999)).rgb;float warm=(.5+.5*sin(t*.3))*.017;gl_FragColor=vec4(col+vec3(warm,warm*.6,warm*.2),1.);}`);
        var program = gl.createProgram();
        gl.attachShader(program,vertex); gl.attachShader(program,fragment); gl.linkProgram(program);
        if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Title renderer unavailable');
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER,gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
        var position = gl.getAttribLocation(program,'p');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,gl.createTexture());
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);
        gl.uniform1i(gl.getUniformLocation(program,'image'),0);
        renderer = {program:program, clock:gl.getUniformLocation(program,'t'), ratio:gl.getUniformLocation(program,'ratio'), pointer:gl.getUniformLocation(program,'mouse')};
        gl.viewport(0,0,surface.width,surface.height);
      } catch (_) { renderer = null; }
      refresh();
    }
    surface.addEventListener('webglcontextlost', function (e) {
      e.preventDefault(); renderer = null; scene.removeAttribute('data-renderer');
    });
    surface.addEventListener('webglcontextrestored', initRenderer);
    function paintImage() {
      if (!renderer) return;
      gl.useProgram(renderer.program); gl.uniform1f(renderer.clock,time);
      gl.uniform2f(renderer.ratio,w,h); gl.uniform2f(renderer.pointer,mouseX,mouseY);
      gl.drawArrays(gl.TRIANGLES,0,6);
      scene.dataset.renderer = 'webgl';
    }
    function petalPath() {
      ctx.beginPath(); ctx.moveTo(0,.95);
      ctx.bezierCurveTo(-.12,.58,-.72,.14,-.57,-.38);
      ctx.bezierCurveTo(-.48,-.83,-.06,-.9,.04,-.68);
      ctx.bezierCurveTo(.28,-.93,.77,-.6,.65,-.18);
      ctx.bezierCurveTo(.57,.33,.2,.7,0,.95); ctx.closePath();
    }
    function paintPetals() {
      ctx.clearRect(0,0,w,h);
      petals.forEach(function(p) {
        var age = (time/p.period+p.offset)%1;
        var x = (1.18-age*1.38)*w+Math.sin(time*.48+p.phase)*w*(.012+p.layer*.006);
        var y = (-.22+p.lane*.58+age*.9)*h+Math.sin(time*.65+p.phase)*8;
        var turn=time*(.75+p.layer*.13)+p.phase, tilt=Math.cos(turn), size=p.size*Math.min(w/1024,1.2);
        var edge=Math.min(1,age*12,(1-age)*12), distance=Math.hypot((x/w-.72)/.25,(y/h-.29)/.18);
        ctx.save(); ctx.translate(x,y); ctx.rotate(-.65+Math.sin(time*.4+p.phase)*.5);
        ctx.scale(size*Math.max(.13,Math.abs(tilt)),size*(.86+.14*Math.sin(turn*.7)));
        ctx.globalAlpha=(p.layer===0?.42:p.layer===1?.65:.48)*edge*(.25+.75*Math.min(1,distance));
        ctx.filter=p.layer===2?'blur(0.7px)':'none';
        var gradient=ctx.createLinearGradient(-.6,-.6,.7,.7);
        gradient.addColorStop(0,tilt>0?'#fff2e7':'#e9b6b6');
        gradient.addColorStop(.5,'#f5d2cc'); gradient.addColorStop(1,tilt>0?'#d78f9d':'#fbe5d4');
        ctx.fillStyle=gradient; petalPath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(0,.82); ctx.quadraticCurveTo(.03,.1,.04,-.63);
        ctx.strokeStyle='rgba(169,97,116,.18)'; ctx.lineWidth=.055; ctx.stroke(); ctx.restore();
      });
      // Distant birds remain small enough to read as part of the landscape.
      for (var j=0;j<5;j++) {
        var bx=((time*.015+j*.19)%1.4-.2)*w, by=(.12+j*.025)*h+Math.sin(time*.32+j)*h*.011;
        if(bx>w*.5)continue;
        var wing=Math.sin(time*5+j)*2;
        ctx.beginPath();ctx.strokeStyle='rgba(55,65,71,.46)';ctx.lineWidth=.8;
        ctx.moveTo(bx-3,by-wing);ctx.quadraticCurveTo(bx-1,by-2,bx,by);ctx.quadraticCurveTo(bx+1,by-2,bx+3,by-wing);ctx.stroke();
      }
    }
    function draw(now) {
      raf=null;
      if (!active || paused) return;
      var dt=last===null?0:Math.min((now-last)/1000,.05);last=now;time+=dt;
      mouseX+=(targetX-mouseX)*Math.min(1,dt*4);mouseY+=(targetY-mouseY)*Math.min(1,dt*4);
      paintImage();paintPetals();raf=requestAnimationFrame(draw);
    }
    function refresh() {
      var wasActive=active;
      active=root.classList.contains('active')&&!document.hidden;
      root.classList.toggle('motion-paused',paused||!active);
      toggle.textContent=paused?'动态背景 · 关':'动态背景 · 开';toggle.setAttribute('aria-pressed',String(paused));
      toggle.setAttribute('aria-label',paused?'播放主界面动态':'暂停主界面动态');
      if(!active||paused) {
        if(raf!==null)cancelAnimationFrame(raf);raf=null;last=null;
        if(active)paintImage();
      } else if(raf===null) {
        if(!wasActive)resize();last=null;raf=requestAnimationFrame(draw);
      }
    }
    toggle.addEventListener('click',function(){paused=!paused;refresh();});
    root.addEventListener('pointermove',function(e){
      if(!active||paused||e.pointerType==='touch')return;
      var rect=root.getBoundingClientRect();targetX=(e.clientX-rect.left)/w-.5;targetY=(e.clientY-rect.top)/h-.5;
    },{passive:true});
    root.addEventListener('pointerleave',function(){targetX=targetY=0;});
    document.addEventListener('visibilitychange',refresh);
    reduced.addEventListener('change',function(){paused=reduced.matches;refresh();});
    new MutationObserver(refresh).observe(root,{attributes:true,attributeFilter:['class']});
    new ResizeObserver(function(){resize();if(active&&paused)paintImage();}).observe(root);
    if(image.complete&&image.naturalWidth)initRenderer();else image.addEventListener('load',initRenderer,{once:true});
    resize();refresh();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
