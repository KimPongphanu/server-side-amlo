"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCharset = void 0;
const setCharset = (req, res, next) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    next();
};
exports.setCharset = setCharset;
//# sourceMappingURL=setCharset.js.map