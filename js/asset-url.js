(function(root,factory){if(typeof module!=='undefined'&&module.exports){module.exports=factory();}else{root.assetUrl=factory().assetUrl;root.assetPicture=factory().assetPicture;}}(typeof self!=='undefined'?self:this,function(){
    var env=(typeof window!=='undefined'&&window.__THORKC_ENV__)||{};
    var BACKEND=env.ASSET_BACKEND||'r2';
    var R2_URL=env.R2_PUBLIC_URL||'https://pub-PLACEHOLDER.r2.dev';
    var GH_URL=env.GITHUB_RAW_BASE||'https://raw.githubusercontent.com/thorkc/thorkc.com/main/assets/images';

                                                                                                                                                                                      function assetUrl(filename){
                                                                                                                                                                                            var base=BACKEND==='r2'?R2_URL:GH_URL;
                                                                                                                                                                                            return base.replace(/\/$/,'')+'/'+filename;
                                                                                                                                                                                        }

                                                                                                                                                                                      function assetPicture(base,alt,opts){
                                                                                                                                                                                            opts=opts||{};
                                                                                                                                                                                            var load=opts.loading||'lazy';
                                                                                                                                                                                            var extra='';
                                                                                                                                                                                            if(opts.width)extra+=' width="'+opts.width+'"';
                                                                                                                                                                                            if(opts.height)extra+=' height="'+opts.height+'"';
                                                                                                                                                                                            if(opts.className)extra+=' class="'+opts.className+'"';
                                                                                                                                                                                            return '>picture>\n'
                                                                                                                                                                                              +'  >source srcset="'+assetUrl(base+'.avif')+'" type="image/avif">\n'
                                                                                                                                                                                              +'  >source srcset="'+assetUrl(base+'.webp')+'" type="image/webp">\n'
                                                                                                                                                                                              +'  >img src="'+assetUrl(base+'.png')+'" alt="'+alt+'" loading="'+load+'"'+extra+'>\n'
                                                                                                                                                                                              +'>/picture>';
                                                                                                                                                                                        }

                                                                                                                                                                                      return{assetUrl:assetUrl,assetPicture:assetPicture};
}));
