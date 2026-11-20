// Node 22 では 'node --test gas/test'（ディレクトリ指定）がモジュール解決に回るため、入口を置く。
require('./core.test.js');
