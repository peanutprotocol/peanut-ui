'use client'

import * as hooks from '@/hooks'
import { useRouter } from 'next/navigation'
import React, { useRef, useEffect } from 'react'
import * as THREE from 'three'

export default function TransferWTF() {
    const router = useRouter()
    const gaEventTracker = hooks.useAnalyticsEventTracker('transferwtf-page')

    useEffect(() => {
        router.push('http://www.transfers.wtf/')
        gaEventTracker('peanut-opened', 'transferwtf')
    }, [])
    return (
        <></>
        // <div className="bg-purple-100 flex h-screen flex-col">
        //     {/* Top Half: Main Content */}
        //     <div className="flex flex-1 flex-col items-center justify-center bg-white p-8">
        //         {/* Large Title and Subheader */}
        //         <h1 className="mb-2 text-7xl text-black">TRANSFERS.WTF</h1>
        //         <h2 className="mb-4 text-2xl text-black">Istanbul - Thursday, November 16th, 2023</h2>

        //         {/* Button */}
        //         <a
        //             href="https://lu.ma/u653ldvn"
        //             className="mb-4 inline-block rounded-none border-2 border-black bg-white px-4 py-2 text-lg font-bold text-black hover:scale-90"
        //             target="_blank"
        //             rel="noopener noreferrer"
        //         >
        //             Register
        //         </a>

        //         {/* Button */}
        //         <a
        //             href="https://docs.google.com/presentation/d/e/2PACX-1vRTVSrU9mSF3vcTZXGn9YrpGs8H9mhJLVsSppMPygs_0EDWESia5G9uQBR8Qggk78Ld4QwXgj0keddC/pub?start=false&loop=false&delayms=3000"
        //             className="mb-4 inline-block rounded-none bg-black px-4 py-2 text-lg font-bold text-white hover:scale-90"
        //             target="_blank"
        //             rel="noopener noreferrer"
        //         >
        //             Present
        //         </a>

        //         {/* Button */}
        //         <a
        //             href="https://t.me/kkonrad"
        //             target="_blank"
        //             className="mb-4 inline-block rounded-none border-none bg-none px-4 py-2 text-lg font-bold text-black hover:scale-90"
        //             rel="noopener noreferrer"
        //         >
        //             Co-host
        //         </a>
        //     </div>

        //     {/* Bottom Half: Iframe */}
        //     <ShaderComponent />
        // </div>
    )
}

const ShaderComponent: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const uniforms = {
            u_time: { type: 'f', value: 1.0 },
            u_resolution: { type: 'v2', value: new THREE.Vector2() },
        }

        const vertexShader = `
      varying vec2 vUv;
      void main() {
        gl_Position = vec4(position, 1.0);
        vUv = uv;
      }
    `

        const fragmentShader = `
    precision highp float;
    
    uniform vec2 u_resolution;
    uniform float u_time;
      varying vec2 vUv;
     
    const float PI = 3.1415926535897932384626433832795;
    const float TAU = PI * 2.;
    const float HALF_PI = PI * .5;
      
    float wiggly(float cx, float cy, float amplitude, float frequency, float spread){
    
      float w = sin(cx * amplitude * frequency * PI) * cos(cy * amplitude * frequency * PI) * spread;
    
      return w;
    }
    
    
    void coswarp(inout vec3 trip, float warpsScale ){
    
      trip.xyz += warpsScale * .1 * cos(3. * trip.yzx + (u_time * .25));
      trip.xyz += warpsScale * .05 * cos(11. * trip.yzx + (u_time * .25));
      trip.xyz += warpsScale * .025 * cos(17. * trip.yzx + (u_time * .25));
      
    }
    
    
    void uvRipple(inout vec2 uv, float intensity){
    
        vec2 p = uv -.5;
    
    
        float cLength=length(p);
    
         uv= uv +(p/cLength)*cos(cLength*15.0-u_time*.5)*intensity;
    
    } 
    
    float smoothMod(float x, float y, float e){
        float top = cos(PI * (x/y)) * sin(PI * (x/y));
        float bot = pow(sin(PI * (x/y)),2.);
        float at = atan(top/bot);
        return y * (1./2.) - (1./PI) * at ;
    }
    
     
     vec2 modPolar(vec2 p, float repetitions) {
        float angle = 2.*3.14/repetitions;
        float a = atan(p.y, p.x) + angle/2.;
        float r = length(p);
        //float c = floor(a/angle);
        a = smoothMod(a,angle,033323231231561.9) - angle/2.;
        //a = mix(a,)
        vec2 p2 = vec2(cos(a), sin(a))*r;
       
       p2 += wiggly(p2.x + u_time * .05, p2.y + u_time * .05, 2., 4., 0.05);
       
      
    
        return p2;
    }
    
      float stroke(float x, float s, float w){
      float d = step(s, x+ w * .5) - step(s, x - w * .5);
      return clamp(d, 0., 1.);
    }
      
     //	Classic Perlin 2D Noise
    //	by Stefan Gustavson
    //
    vec4 permute(vec4 x)
    {
        return mod(((x*34.0)+1.0)*x, 289.0);
    }
    
    
    vec2 fade(vec2 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
    
    float cnoise(vec2 P){
      vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
      vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
      Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
      vec4 ix = Pi.xzxz;
      vec4 iy = Pi.yyww;
      vec4 fx = Pf.xzxz;
      vec4 fy = Pf.yyww;
      vec4 i = permute(permute(ix) + iy);
      vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
      vec4 gy = abs(gx) - 0.5;
      vec4 tx = floor(gx + 0.5);
      gx = gx - tx;
      vec2 g00 = vec2(gx.x,gy.x);
      vec2 g10 = vec2(gx.y,gy.y);
      vec2 g01 = vec2(gx.z,gy.z);
      vec2 g11 = vec2(gx.w,gy.w);
      vec4 norm = 1.79284291400159 - 0.85373472095314 *
        vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
      g00 *= norm.x;
      g01 *= norm.y;
      g10 *= norm.z;
      g11 *= norm.w;
      float n00 = dot(g00, vec2(fx.x, fy.x));
      float n10 = dot(g10, vec2(fx.y, fy.y));
      float n01 = dot(g01, vec2(fx.z, fy.z));
      float n11 = dot(g11, vec2(fx.w, fy.w));
      vec2 fade_xy = fade(Pf.xy);
      vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
      float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
      return 2.3 * n_xy;
    }
      
    vec2 rotate2D (vec2 _st, float _angle) {
        _st -= 0.5;
        _st =  mat2(cos(_angle),-sin(_angle),
                    sin(_angle),cos(_angle)) * _st;
        _st += 0.5;
        return _st;
    }
    
    
    
    vec2 rotateTilePattern(vec2 _st){
    
      float t = (u_time * .25)  ;
      
        //  Scale the coordinate system by 2x2
        _st *= 2.0;
    
        //  Give each cell an index number
        //  according to its position
        float index = 0.0;
        index += step(1., mod(_st.x,2.0));
        index += step(1., mod(_st.y,2.0))*2.0;
    
        //      |
        //  2   |   3
        //      |
        //--------------
        //      |
        //  0   |   1
        //      |
    
        // Make each cell between 0.0 - 1.0
        _st = fract(_st);
    
        // Rotate each cell according to the index
      
       if(index == 0.0){
            //  Rotate cell 1 by 90 degrees
            _st = rotate2D(_st,PI );
        }
      
        if(index == 1.0){
            //  Rotate cell 1 by 90 degrees
            _st = rotate2D(_st,PI*0.5 );
        } else if(index == 2.0){
            //  Rotate cell 2 by -90 degrees
            _st = rotate2D(_st,PI*-0.5 );
        } else if(index == 3.0){
            //  Rotate cell 3 by 180 degrees
            _st = rotate2D(_st,PI );
        }
    
        return _st;
    }
    
      vec2 tile(vec2 st, float _zoom){
        float vTime = u_time;
        st *= _zoom;
      
        return fract(st);
    }
    
      vec2 rotateUV(vec2 uv, vec2 pivot, float rotation) {
      mat2 rotation_matrix=mat2(  vec2(sin(rotation),-cos(rotation)),
                                  vec2(cos(rotation),sin(rotation))
                                  );
      uv -= pivot;
      uv= uv*rotation_matrix;
      uv += pivot;
      return uv;
    }
      
    void coswarp2(inout vec2 trip, float warpsScale ){
    
      float vTime = u_time;
      trip.xy += warpsScale * .1 * cos(3. * trip.yx + (vTime * .25));
      trip.xy += warpsScale * .05 * cos(11. * trip.yx + (vTime * .25));
      trip.xy += warpsScale * .025 * cos(17. * trip.yx + (vTime * .25));
     
    }
      
    float roundedBoxSDF(vec2 CenterPosition, vec2 Size, float Radius) {
        return length(max(abs(CenterPosition)-Size+Radius,0.0))-Radius;
    }
    
    float shape( in vec2 p, float sides ,float size)
    {
      
       float d = 0.0;
      vec2 st = p *2.-1.;
    
      // Number of sides of your shape
      float N = sides ;
    
      // Angle and radius from the current pixel
      float a = atan(st.x,st.y)+PI ;
      float r = (2.* PI)/(N) ;
    
      // Shaping function that modulate the distance
      d = cos(floor(.5+a/r)*r-a)*length(st);
      
    
      return  1.0-smoothstep(size,size +.1,d);
    }
    
      
    void main() {
        vec2 uv = (gl_FragCoord.xy - u_resolution * .5) / u_resolution.yy + 0.5;
      
      float vTime = u_time * .5 ;
      float t = (u_time * .025) + length(uv -.5) ;
      
       float t2 = (u_time * .025) + uv.x ;
      
        float t3 = (u_time * .0125) + uv.y ;
      
      vec2 uv2 = uv;
       vec2 uv4= uv;
    
     
    
      
      uv = rotateTilePattern(uv);
       uv = rotateTilePattern(uv * sin(t2) );
      
        uv = rotateTilePattern(uv);
    
      
        uv = rotateTilePattern(uv * sin(t3) );
      
        uv = rotateTilePattern(uv);
      
        uv = rotateTilePattern(uv * sin(t));
    
      
        
        vec3 color = vec3(1.);
      
      vec3 warp = vec3(uv.x, uv.y, 1.);
      
      coswarp(warp, 3.);
      coswarp(warp, 3.);
    
      
      
      
        color = mix(color, 1.-color, step(shape(uv, 4., .81), .01));
      
      
    
      color = vec3(mix(step(color.r,.5), step(color.g,.5), step(sin(t), .5)));
    
        
        gl_FragColor = vec4(vec3(color.r, color.g, color.b), 1.0);
    }
    `

        let camera: THREE.Camera, scene: THREE.Scene, renderer: THREE.WebGLRenderer
        let clock = new THREE.Clock()

        camera = new THREE.Camera()
        camera.position.z = 1

        scene = new THREE.Scene()

        const geometry = new THREE.PlaneGeometry(2, 2)

        const material = new THREE.ShaderMaterial({
            uniforms,
            vertexShader,
            fragmentShader,
        })

        const mesh = new THREE.Mesh(geometry, material)
        scene.add(mesh)

        renderer = new THREE.WebGLRenderer()
        renderer.setPixelRatio(window.devicePixelRatio)

        const container = containerRef.current!
        container.appendChild(renderer.domElement)

        const onWindowResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight)
            uniforms.u_resolution.value.x = renderer.domElement.width
            uniforms.u_resolution.value.y = renderer.domElement.height
        }

        window.addEventListener('resize', onWindowResize)
        onWindowResize()

        const animate = () => {
            uniforms.u_time.value = clock.getElapsedTime()
            renderer.render(scene, camera)
            requestAnimationFrame(animate)
        }

        animate()

        return () => {
            window.removeEventListener('resize', onWindowResize)
            container.removeChild(renderer.domElement)
            scene.remove()
            geometry.dispose()
            material.dispose()
        }
    }, [])

    return <div ref={containerRef} id="shader" style={{ width: '100vw', height: '100vh' }} />
}
