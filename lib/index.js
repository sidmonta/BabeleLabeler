"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ramda_1 = require("ramda");
const tools_1 = require("@sidmonta/babelelibrary/build/tools");
const lods_1 = require("@sidmonta/babelelibrary/build/lods");
const stream_1 = require("@sidmonta/babelelibrary/build/stream");
const operators_1 = require("rxjs/operators");
const patternURI = ramda_1.pipe((uri) => new URL(uri), (url) => url.origin + url.pathname);
let Labeler = /** @class */ (() => {
    class Labeler {
        static async __(uri, proxy = '') {
            if (!tools_1.validURL(uri)) {
                return Promise.resolve(uri);
            }
            if (Labeler.store.has(uri)) {
                return Promise.resolve(Labeler.store.get(uri));
            }
            if (proxy) {
                Labeler.proxy = proxy;
            }
            let uriForRequest = '';
            try {
                uriForRequest = Labeler.proxy + patternURI(uri);
            }
            catch (e) {
                Labeler.store.set(uri, uri);
                return Promise.resolve(uri);
            }
            const id = lods_1.getID(uri) || uri;
            try {
                return new Promise(resolve => {
                    stream_1.fetchSPARQL(uriForRequest)
                        .pipe(operators_1.filter((quad) => { var _a; return ((_a = quad === null || quad === void 0 ? void 0 : quad.predicate) === null || _a === void 0 ? void 0 : _a.value) === 'http://www.w3.org/2000/01/rdf-schema#label'; }))
                        .subscribe((quad) => { var _a, _b; Labeler.store.set(((_a = quad === null || quad === void 0 ? void 0 : quad.subject) === null || _a === void 0 ? void 0 : _a.value) || '', ((_b = quad === null || quad === void 0 ? void 0 : quad.object) === null || _b === void 0 ? void 0 : _b.value) || ''); }, _ => { Labeler.store.set(uri, id) && resolve(id); }, () => { Labeler.history.add(uri) && resolve(Labeler.store.get(uri) || id); });
                });
            }
            catch (e) {
                return Promise.resolve(id);
            }
        }
        static prepopulate(obj) {
            ramda_1.forEachObjIndexed((value, key) => {
                Labeler.store.set(key, value);
            }, obj);
        }
        static async prefetch(urls, proxy = '') {
            await ramda_1.pipe(ramda_1.map((url) => Labeler.__(url, proxy)), urlsPromise => Promise.all(urlsPromise))(urls);
        }
        static async all(urls, proxy = '') {
            return await ramda_1.pipe(ramda_1.map((url) => Labeler.__(url, proxy)), urlsPromise => Promise.all(urlsPromise))(urls);
        }
    }
    Labeler.store = new Map();
    Labeler.history = new Set();
    Labeler.proxy = '';
    return Labeler;
})();
exports.default = Labeler;
//# sourceMappingURL=index.js.map