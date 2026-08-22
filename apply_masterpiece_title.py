import os

old_block = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-1 mt-2 lg:mt-6">
                    <div class="flex flex-wrap items-center justify-center gap-3 lg:gap-5 mb-1">
                        <h1 id="mainTitle" class="text-4xl lg:text-5xl font-serif font-black uppercase tracking-[0.25em] leading-tight text-center" style="background: linear-gradient(135deg, #ffffff 0%, #a5f3fc 25%, #06b6d4 50%, #3b82f6 75%, #ffffff 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 25px rgba(6, 182, 212, 0.8));">
                            PRESENSI<br>BIOMETRIK
                        </h1>
                    </div>
                    <div class="flex items-center justify-center w-full max-w-lg mb-1 mt-1">
                        <div class="h-[1px] flex-grow" style="background: linear-gradient(to right, transparent, rgba(34, 211, 238, 0.8));"></div>
                        <h2 class="px-5 text-xl font-serif font-extrabold tracking-[0.3em] uppercase" style="background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 50%, #06b6d4 100%); background-size: 200% auto; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.8)); animation: shine 3s linear infinite;">PUSKESMAS WANA</h2>
                        <div class="h-[1px] flex-grow" style="background: linear-gradient(to left, transparent, rgba(34, 211, 238, 0.8));"></div>
                    </div>
                    <h3 class="text-sm font-serif font-medium text-white/60 tracking-[0.4em] uppercase mb-2">
                        KABUPATEN LAMPUNG TIMUR
                    </h3>
                </div>"""

new_block = """                <div class="w-full text-center flex flex-col items-center justify-center pt-0 pb-0 mb-3 mt-2 lg:mt-6 relative">
                    <!-- Ambient backglow for the whole title area -->
                    <div class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-[200%] bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.1)_0%,transparent_60%)] pointer-events-none blur-xl z-0"></div>

                    <div class="flex flex-wrap items-center justify-center gap-3 lg:gap-5 mb-1 relative z-10">
                        <h1 id="mainTitle" class="text-5xl lg:text-6xl font-serif font-black uppercase tracking-[0.3em] leading-tight text-center relative" 
                            style="
                                background: linear-gradient(to right, #ffffff 0%, #cffafe 25%, #06b6d4 50%, #cffafe 75%, #ffffff 100%); 
                                background-size: 200% auto; 
                                -webkit-background-clip: text; 
                                background-clip: text; 
                                color: transparent; 
                                -webkit-text-fill-color: transparent; 
                                filter: drop-shadow(0 0 30px rgba(6, 182, 212, 0.8)) drop-shadow(0 0 10px rgba(255, 255, 255, 0.6)); 
                                animation: shine 4s linear infinite;
                            ">
                            PRESENSI<br>BIOMETRIK
                        </h1>
                    </div>
                    
                    <div class="flex items-center justify-center w-full max-w-2xl mb-3 mt-4 relative z-10">
                        <div class="h-[2px] flex-grow" style="background: linear-gradient(to right, transparent, rgba(34,211,238,0.8), #ffffff); box-shadow: 0 0 10px rgba(6,182,212,0.8);"></div>
                        
                        <h2 class="px-6 text-xl lg:text-2xl font-serif font-extrabold tracking-[0.4em] uppercase relative" 
                            style="
                                background: linear-gradient(90deg, #3b82f6 0%, #22d3ee 30%, #ffffff 50%, #22d3ee 70%, #3b82f6 100%); 
                                background-size: 200% auto; 
                                -webkit-background-clip: text; 
                                background-clip: text; 
                                color: transparent; 
                                -webkit-text-fill-color: transparent; 
                                filter: drop-shadow(0 0 20px rgba(34, 211, 238, 0.9)); 
                                animation: shine 3s reverse linear infinite;
                            ">
                            PUSKESMAS WANA
                        </h2>
                        
                        <div class="h-[2px] flex-grow" style="background: linear-gradient(to left, transparent, rgba(34,211,238,0.8), #ffffff); box-shadow: 0 0 10px rgba(6,182,212,0.8);"></div>
                    </div>
                    
                    <h3 class="text-sm lg:text-base font-sans font-bold tracking-[0.6em] uppercase mb-2 relative z-10"
                        style="
                            color: #cffafe;
                            text-shadow: 0 0 12px rgba(6, 182, 212, 0.7);
                        ">
                        KABUPATEN LAMPUNG TIMUR
                    </h3>
                </div>"""

with open('scan.html', 'r', encoding='utf-8') as f:
    html = f.read()

if old_block in html:
    html = html.replace(old_block, new_block)
    with open('scan.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print("Successfully replaced title block!")
else:
    print("Could not find the exact old title block. Please check differences.")
