const fs = require('fs');

const file = 'src/app/about/our-mission/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const section = `
        {/* Experience Section */}
        <section className="py-14 md:py-24 bg-neutral-50/50 border-y border-neutral-100" id="" data-track-region="section" data-track-region-variant="experience-section">
          <div className="max-w-7xl mx-auto w-full px-6 md:px-8 lg:px-16">
            <div className="relative z-10 text-center">
              <svg className="mx-auto mb-4 text-primary" fill="none" height="18" viewBox="0 0 24 18" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="M14.0288 2.40948V17.9997H23.7527V0H20.0825L14.0288 2.40948Z" fill="currentColor"></path>
                <path d="M7.13818 5.15704V17.9998H11.6102V3.37427L7.13818 5.15704Z" fill="currentColor"></path>
                <path d="M0.247559 7.90456V17.9998H4.72567V6.11646L0.247559 7.90456Z" fill="currentColor"></path>
              </svg>
              <h2 className="font-display text-neutral-900 m-auto max-w-2xl text-3xl md:text-5xl mb-3 md:mb-4">
                Real trading experience, without the risk.
              </h2>
              <p className="md:text-xl max-w-lg mx-auto mb-11 md:mb-14 text-neutral-600">
                You're four steps away from harnessing your trading skills. It's simple. Here's how it works:
              </p>
            </div>
            
            <div className="mt-11 md:mt-14">
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                {/* Step 1 */}
                <div className="bg-white border border-neutral-200 lg:hover:bg-primary group lg:hover:text-white flex flex-col justify-between gap-2.5 rounded-2xl p-6 duration-300 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between gap-3">
                    <h2 className="text-2xl lg:text-3xl font-semibold font-jakarta">Complete a challenge</h2>
                    <span className="text-2xl lg:text-3xl font-bold opacity-30">01</span>
                  </div>
                  <svg className="text-primary lg:group-hover:text-white stroke-neutral-200 lg:group-hover:stroke-white w-full duration-300 lg:group-hover:scale-110 my-6" fill="none" height="165" viewBox="0 0 262 165" width="262" xmlns="http://www.w3.org/2000/svg">
                    <path d="M178.473 43.8699V85.0603L168.216 90.9729V120.393L157.96 126.317V96.8964L147.703 102.82V61.6295L156.534 56.5287L157.96 55.706V32.1765L168.216 26.2529V49.7934L178.473 43.8699Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M116.931 138.229V150L94.9922 139.03V138.317L95.6613 138.646L106.675 144.153L116.931 138.229Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M137.43 55.7829V126.393L127.174 132.317V144.076L116.928 150V138.23L106.672 144.153V73.5424L115.491 68.4635L116.928 67.6298V55.8596L125.748 50.7587L125.836 50.704L126.505 50.32L127.174 49.936V61.7063L136.761 56.1668L137.43 55.7829Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M137.444 55.7824L136.775 56.1663L127.188 61.7058V50.6597L137.444 55.7824Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M116.931 55.8591V67.6294L115.494 66.9164L94.9922 56.6599V44.8896L105.238 50.0125L105.907 50.3525L115.494 55.1461L116.931 55.8591Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M116.93 67.6296L115.493 68.4633L106.673 73.5422L84.7344 62.5727L94.9909 56.6602L115.493 66.9166L116.93 67.6296Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M157.958 96.896V126.316L137.445 116.06V97.6968L146.276 102.106L147.702 102.82L157.958 96.896Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M157.951 55.7058L156.525 56.5285L147.694 61.6293L137.438 56.5066V55.7827L127.182 50.6598V49.9359L127.094 49.8921L136.012 44.7363L156.525 54.9928L157.951 55.7058Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M168.203 26.2527L157.947 32.1762L146.264 26.3403L136.008 21.2067L146.264 15.2832L168.203 26.2527Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M157.947 32.176V55.7055L156.521 54.9924L136.008 44.736V21.2065L146.264 26.3402L157.947 32.176Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M178.467 43.8699L168.211 49.7933V38.7471L178.467 43.8699Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M147.702 61.6296V102.82L146.276 102.107L137.445 97.6972V56.5068L147.702 61.6296Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M106.673 73.5422V144.152L95.66 138.646L94.9909 138.318L84.7344 133.183V62.5728L106.673 73.5422Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                    <path d="M127.177 49.9358L126.508 50.3197L125.838 50.7038L125.751 50.7585L116.931 55.8594L115.494 55.1463L105.907 50.3526L105.238 50.0127L94.9922 44.8899L105.238 38.9663L127.089 49.892L127.177 49.9358Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.844318"></path>
                  </svg>
                  <p className="leading-5 text-sm text-neutral-600 lg:group-hover:text-primary-foreground font-medium">Prove your trading powers and complete a challenge or go straight to funded with Instant Funding. Choose any of our 400+ pair options.</p>
                </div>

                {/* Step 2 */}
                <div className="bg-white border border-neutral-200 lg:hover:bg-primary group lg:hover:text-white flex flex-col justify-between gap-2.5 rounded-2xl p-6 duration-300 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between gap-3">
                    <h2 className="text-2xl lg:text-3xl font-semibold font-jakarta">Get verified</h2>
                    <span className="text-2xl lg:text-3xl font-bold opacity-30">02</span>
                  </div>
                  <svg className="text-primary lg:group-hover:text-white stroke-neutral-200 lg:group-hover:stroke-white w-full duration-300 lg:group-hover:scale-110 my-6" fill="none" height="165" viewBox="0 0 262 165" width="262" xmlns="http://www.w3.org/2000/svg">
                    <path d="M160.234 30.6911L143.395 33.164L103.553 73.3171V108.179C103.553 120.44 106.244 130.205 111.65 137.475C112.605 138.786 113.675 140.028 114.825 141.178C116.78 143.133 118.873 144.721 121.093 145.94L122.565 146.676C128.558 149.483 135.505 149.747 143.395 147.47C154.932 137.475 164.455 124.374 171.977 108.179C179.488 91.9846 183.238 76.6526 183.238 62.1718V27.3096L160.234 30.6911ZM151.884 89.9603L138.162 113.62L120.61 103.613L127.373 91.9386L127.707 91.375L138.162 97.333L159.21 61.0446L159.578 61.2516L166.307 65.0932L151.884 89.9603Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                    <path d="M127.706 91.3755L127.373 91.9391L138.162 97.3335L127.706 91.3755Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                    <path d="M143.399 33.1645L103.556 73.3175L80.5527 61.8156L120.395 21.6626L143.399 33.1645Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                    <path d="M183.243 27.3099L160.239 30.6915L143.4 33.1644L120.396 21.6626L160.239 15.8081L183.243 27.3099Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                    <path d="M121.097 145.94L99.3584 135.082L98.5878 134.703C96.1724 133.449 93.918 131.77 91.8247 129.676C84.3139 122.154 80.5527 111.158 80.5527 96.6776V61.8154L103.556 73.3173V108.179C103.556 120.44 106.248 130.206 111.654 137.475C112.608 138.786 113.678 140.028 114.828 141.178C116.784 143.134 118.877 144.721 121.097 145.94Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                    <path d="M122.787 146.791L122.568 146.676L122.787 146.791Z" fill="currentColor"></path>
                    <path d="M122.787 146.791L122.568 146.676" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.885296"></path>
                  </svg>
                  <p className="leading-5 text-sm text-neutral-600 lg:group-hover:text-primary-foreground font-medium">If you're currently on the 2-step challenge, redo it with easier rules so we know the first trial wasn't just luck.</p>
                </div>

                {/* Step 3 */}
                <div className="bg-white border border-neutral-200 lg:hover:bg-primary group lg:hover:text-white flex flex-col justify-between gap-2.5 rounded-2xl p-6 duration-300 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between gap-3">
                    <h2 className="text-2xl lg:text-3xl font-semibold font-jakarta">Become a funded trader</h2>
                    <span className="text-2xl lg:text-3xl font-bold opacity-30">03</span>
                  </div>
                  <svg className="text-primary lg:group-hover:text-white stroke-neutral-200 lg:group-hover:stroke-white w-full duration-300 lg:group-hover:scale-110 my-6" fill="none" height="165" viewBox="0 0 262 165" width="262" xmlns="http://www.w3.org/2000/svg">
                    <path d="M173.655 47.7149L169.808 49.9391C167.11 51.4986 164.566 53.4543 162.189 55.8319C160.911 57.0846 159.683 58.4396 158.507 59.9224C155.094 64.2047 152.397 68.8961 150.441 74.0092L139.064 80.5669C137.812 78.7517 136.265 77.4608 134.424 76.6554L134.322 76.6169C133.926 76.4508 133.542 76.3229 133.108 76.2079C132.443 76.0162 131.74 75.8883 130.998 75.8116C127.585 75.4665 123.814 76.4892 119.698 78.8669L105.842 86.869L82.9219 100.099V112.984L88.5335 109.738L89.7481 120.143L91.1667 132.21L91.4863 134.933C92.1255 140.583 94.1581 144.546 97.5839 146.834H97.5967C98.2103 147.256 98.8622 147.614 99.5525 147.908C104.193 149.914 109.587 149.122 115.774 145.555C121.104 142.475 125.898 137.937 130.155 131.942C134.411 125.934 137.377 119.555 139.064 112.78L140.649 106.312L141.174 104.152C141.314 103.512 141.455 102.848 141.595 102.17C141.647 101.953 141.685 101.723 141.736 101.493C141.928 100.585 142.107 99.4217 142.298 98.0284L147.067 95.28C147.258 96.6734 147.437 97.7216 147.629 98.4119C147.731 98.7698 147.821 99.1149 147.91 99.4473C148 99.7796 148.102 100.112 148.192 100.432L150.301 106.452C151.541 110.032 153.496 112.575 156.168 114.058C157.088 114.582 158.111 114.979 159.21 115.247C163.467 116.27 168.261 115.247 173.591 112.166C179.765 108.613 185.172 103.154 189.812 95.8043C194.44 88.4669 197.124 81.0271 197.878 73.5107L200.818 44.9153L206.443 41.6685V28.7832L173.655 47.7149ZM131.318 101.646C131.19 103.09 130.909 104.624 130.5 106.286L128.404 114.915C127.471 118.571 125.847 122.022 123.559 125.282C121.271 128.528 118.663 130.996 115.774 132.67C112.399 134.613 109.472 135.022 106.992 133.872C104.512 132.734 103.042 130.408 102.569 126.918L102.071 122.457L100.486 108.331L99.9104 103.18L103.017 101.39L114.828 94.5643L119.698 91.7519C121.079 90.9594 122.357 90.4481 123.533 90.2563C125.924 89.8217 127.88 90.6398 129.388 92.6851C131.011 94.8965 131.65 97.875 131.318 101.646ZM186.783 78.3043C186.322 82.3309 184.854 86.3448 182.374 90.3586C179.893 94.3597 176.966 97.3381 173.591 99.2811C170.689 100.968 168.095 101.493 165.807 100.892C163.518 100.278 161.895 98.6803 160.962 96.1109L159.031 90.1157L158.993 90.0007C157.498 85.7056 157.881 80.7203 160.118 75.0191C162.368 69.3179 165.589 65.2529 169.808 62.8242L172.236 61.418L189.456 51.4729L186.783 78.3043Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M82.9253 100.099V112.984L76.521 109.788V109.776L63.7253 103.384L57.3594 100.201V87.3159L74.9871 96.1235V96.1363L82.9253 100.099Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M134.325 76.617C133.929 76.4508 133.546 76.323 133.111 76.2079C132.446 76.0162 131.743 75.8884 131.002 75.8117C127.589 75.4665 123.818 76.4892 119.702 78.8668L105.845 86.8689L82.9253 100.099L74.9871 96.1365L57.3594 87.3163L94.1359 66.0838C98.252 63.7062 102.023 62.6836 105.436 63.0287C106.816 63.1693 108.082 63.5018 109.22 64.0387L109.501 64.1792L114.985 66.9274L133.047 75.9651L134.325 76.617Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M206.443 28.7829L173.655 47.7146L169.807 49.9388C167.11 51.4983 164.566 53.454 162.188 55.8316C160.91 57.0843 159.683 58.4393 158.507 59.9221C155.094 64.2044 152.397 68.8958 150.441 74.0089L133.452 65.5211L124.875 61.226C126.831 56.1128 129.528 51.4215 132.941 47.1392C136.354 42.8569 140.125 39.5335 144.241 37.1559L180.877 16L206.443 28.7829Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M156.167 114.059L140.648 106.312L141.173 104.152C141.313 103.513 141.454 102.848 141.594 102.17C141.646 101.953 141.684 101.723 141.735 101.493C141.927 100.585 142.106 99.4219 142.298 98.0286L147.066 95.2803C147.257 96.6736 147.436 97.7218 147.628 98.4121C147.73 98.77 147.82 99.1151 147.909 99.4475C147.999 99.7799 148.101 100.112 148.191 100.432L150.3 106.453C151.54 110.032 153.496 112.576 156.167 114.059Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M98.1177 147.102L97.5938 146.846L98.1177 147.102Z" fill="currentColor"></path>
                    <path d="M98.1177 147.102L97.5938 146.846" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M97.5808 146.834L73.4467 134.881C69.1517 132.785 66.6461 128.541 65.9174 122.15L63.7188 103.384L76.5145 109.776L82.9187 112.984L88.5303 109.738L89.745 120.143L91.1637 132.21L91.4833 134.933C92.1225 140.583 94.1549 144.545 97.5808 146.834Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                    <path d="M150.444 74.009L139.067 80.5667C137.814 78.7515 136.268 77.4605 134.427 76.6552L134.325 76.6167L133.047 75.9776L114.984 66.9273L124.878 61.2261L133.456 65.5211L150.444 74.009Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.983899"></path>
                  </svg>
                  <p className="leading-5 text-sm text-neutral-600 lg:group-hover:text-primary-foreground font-medium">Congratulations! You've got a simulated funded trading account and you can keep 80% of the profits you make.</p>
                </div>

                {/* Step 4 */}
                <div className="bg-white border border-neutral-200 lg:hover:bg-primary group lg:hover:text-white flex flex-col justify-between gap-2.5 rounded-2xl p-6 duration-300 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between gap-3">
                    <h2 className="text-2xl lg:text-3xl font-semibold font-jakarta">Get paid</h2>
                    <span className="text-2xl lg:text-3xl font-bold opacity-30">04</span>
                  </div>
                  <svg className="text-primary lg:group-hover:text-white stroke-neutral-200 lg:group-hover:stroke-white w-full duration-300 lg:group-hover:scale-110 my-6" fill="none" height="165" viewBox="0 0 262 165" width="262" xmlns="http://www.w3.org/2000/svg">
                    <path d="M138.227 111.949C138.573 112.175 138.933 112.349 139.307 112.482L138.227 111.949Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02629"></path>
                    <path d="M189.2 42.667C186.706 37.4935 183.333 33.6801 179.066 31.2533L177.053 30.24H177.013C173.226 28.5466 168.893 27.9199 164.012 28.3066C163.386 28.3599 162.759 28.4266 162.132 28.5199C156.906 29.2666 151.372 31.3333 145.532 34.7068C141.385 37.1068 137.385 39.9736 133.545 43.3337C132.625 44.147 131.705 44.987 130.798 45.8671C129.532 47.0671 128.278 48.3338 127.038 49.6538C126.438 50.2939 125.851 50.9339 125.278 51.5872C120.478 56.974 116.238 62.7875 112.558 69.0277C112.544 69.0544 112.531 69.0677 112.518 69.0944C112.331 69.3877 112.158 69.6811 111.984 69.9744C110.211 73.0278 108.598 76.1346 107.144 79.308C105.078 83.7881 103.304 88.3749 101.851 93.095C99.3707 101.149 98.1172 108.935 98.1172 116.469C98.1172 124.003 99.3707 130.349 101.851 135.523C101.984 135.803 102.117 136.07 102.264 136.336C104.704 141.11 107.944 144.643 111.984 146.95C112.091 147.017 112.198 147.084 112.318 147.137L112.651 147.31L113.331 147.657H113.344C117.305 149.564 121.865 150.31 127.038 149.884C132.812 149.404 138.972 147.284 145.532 143.496C152.079 139.71 158.239 134.723 164.012 128.536C169.786 122.349 174.799 115.576 179.066 108.215C183.333 100.855 186.706 93.1484 189.2 85.0948C191.68 77.0413 192.933 69.2544 192.933 61.7342C192.933 54.214 191.68 47.8538 189.2 42.667ZM159.746 106.855C156.905 111.229 153.506 114.949 149.559 118.042V124.843L141.265 129.643V122.563C137.545 123.709 134.518 123.616 132.198 122.296C131.758 122.042 131.345 121.762 130.958 121.429C129.412 120.122 128.198 118.176 127.305 115.589C127.211 115.296 127.118 115.029 127.038 114.736L127.798 113.962L132.251 109.389L132.532 109.095L134.865 106.682C135.625 109.229 136.732 110.976 138.185 111.922L138.225 111.949L139.305 112.482C139.425 112.522 139.558 112.562 139.692 112.602C141.612 113.122 143.785 112.669 146.239 111.256C148.839 109.762 151.079 107.762 152.932 105.282C154.785 102.815 155.719 100.082 155.719 97.0818C155.719 94.8551 155.012 93.3884 153.626 92.695L153.239 92.5083C153.105 92.455 152.959 92.415 152.812 92.375C152.705 92.3483 152.599 92.3217 152.492 92.3083C150.505 91.8683 147.159 92.0283 142.438 92.775C138.718 93.4017 135.798 93.3484 133.665 92.5883C133.132 92.4017 132.638 92.175 132.198 91.895C130.305 90.695 129.238 88.4149 128.985 85.0281C128.945 84.5215 128.931 83.9881 128.931 83.4414C128.931 83.1481 128.945 82.8547 128.972 82.5481C128.985 81.8947 129.052 81.2414 129.158 80.5614C129.158 80.5347 129.172 80.4947 129.172 80.468C129.305 79.5613 129.505 78.628 129.758 77.6813C130.305 75.6812 131.145 73.6145 132.251 71.4678C132.638 70.7344 133.038 70.0011 133.492 69.2944C135.558 65.9076 138.225 62.8542 141.492 60.1475V53.3473L143.479 52.2006L144.679 51.5072L149.785 48.5605V55.3607C150.265 55.134 150.745 54.934 151.212 54.774C153.506 53.9606 155.626 53.9873 157.559 54.814C159.879 55.8273 161.479 57.6674 162.359 60.3475L154.772 68.2543C154.132 66.5343 153.105 65.3876 151.692 64.8009C150.265 64.2142 148.292 64.6542 145.758 66.121C142.998 67.7077 140.878 69.6144 139.425 71.8144C138.198 73.6412 137.492 75.5345 137.292 77.4813C137.252 77.8679 137.225 78.2546 137.225 78.6546C137.225 79.0946 137.252 79.4947 137.332 79.868C137.518 80.9614 137.985 81.748 138.732 82.2014C139.078 82.4281 139.492 82.5747 139.958 82.6547C141.772 82.9748 145.052 82.6681 149.785 81.7347C153.679 81.108 156.692 81.1747 158.812 81.9614C159.786 82.3081 160.572 82.8147 161.172 83.4681C163.066 85.5482 164.012 88.4816 164.012 92.295C164.012 97.6418 162.586 102.495 159.746 106.855Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02629"></path>
                    <path d="M177.268 30.3331C177.201 30.2931 177.121 30.2664 177.055 30.2397L179.068 31.2531C178.481 30.9198 177.881 30.6131 177.268 30.3331Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02629"></path>
                    <path d="M177.016 30.2263C173.229 28.5463 168.896 27.9196 164.016 28.3063C163.389 28.3596 162.762 28.4263 162.136 28.5196C156.909 29.2663 151.375 31.333 145.535 34.7064C141.388 37.1065 137.388 39.9732 133.548 43.3333C132.628 44.1467 131.708 44.9867 130.801 45.8667C129.535 47.0668 128.281 48.3335 127.041 49.6535C126.441 50.2935 125.855 50.9335 125.281 51.5869C120.481 56.9737 116.241 62.7872 112.561 69.0274C112.548 69.054 112.534 69.0674 112.521 69.094C112.334 69.3874 112.161 69.6807 111.988 69.9741C110.214 73.0275 108.601 76.1342 107.148 79.3077C105.081 83.7878 103.307 88.3746 101.854 93.0947C99.374 101.148 98.1205 108.935 98.1205 116.469C98.1205 124.002 99.374 130.349 101.854 135.523C101.987 135.803 102.121 136.069 102.267 136.336C104.707 141.109 107.948 144.643 111.988 146.95C112.094 147.017 112.201 147.083 112.321 147.137L87.1202 134.522L85.3202 133.616C81.0535 131.176 77.68 127.376 75.1866 122.189C72.7066 117.015 71.4531 110.655 71.4531 103.135C71.4531 95.6148 72.7066 87.8146 75.1866 79.761C77.68 71.7074 81.0535 64.0006 85.3202 56.6404C89.587 49.2802 94.6005 42.5066 100.374 36.3198C106.147 30.133 112.308 25.1595 118.868 21.3728C125.415 17.586 131.575 15.4526 137.348 14.9726C142.348 14.5592 146.789 15.2393 150.669 17.026L150.842 17.106L151.522 17.4526L177.016 30.2263Z" fill="currentColor" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02629"></path>
                    <path d="M113.557 147.764L113.344 147.657L113.557 147.764Z" fill="currentColor"></path>
                    <path d="M113.557 147.764L113.344 147.657" stroke="inherit" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.02629"></path>
                  </svg>
                  <p className="leading-5 text-sm text-neutral-600 lg:group-hover:text-primary-foreground font-medium">Our Payout frequency on our standard accounts is 10 business days!</p>
                </div>
              </div>

              <a className="hover:text-primary flex items-center justify-center gap-3 duration-300 md:text-lg font-medium mt-9 lg:mt-14" href="/faqs">
                Check our FAQ and rules
                <svg fill="none" height="10" viewBox="0 0 6 10" width="6" xmlns="http://www.w3.org/2000/svg">
                  <path d="M0.75 0.499878L5.25 4.99988L0.75 9.49988" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"></path>
                </svg>
              </a>
            </div>
          </div>
        </section>
        {/* Testimonials */}
`;

content = content.replace('{/* Testimonials */}', section);
fs.writeFileSync(file, content);
console.log("Section added!");
