import {assert} from 'chai';

import {LRUCache} from '../esm/lru_cache';

describe('LRC cache', function () {
    it('restricts max size by evicting old items', function () {
        const cache = new LRUCache(3);
        ['a', 'b', 'c', 'd', 'e'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 3, 'Wrong number of cache entries');
        assert.sameOrderedMembers([...cache._store.keys()], ['c', 'd', 'e'], 'Incorrect cache members');
    });

    it('does not cache if max size is 0', function () {
        const cache = new LRUCache(0);
        ['a', 'b', 'c', 'd', 'e'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 0, 'No items cached');
        assert.isNull(cache._head, 'No head node');
        assert.isNull(cache._tail, 'No tail node');
    });

    it('does not support "negative number for infinite cache"', function () {
        assert.throws(
            () => new LRUCache(-12),
            /must be >= 0/,
        );
    });

    it('promotes cache entries by most recently read', function () {
        const cache = new LRUCache(3);
        ['a', 'b', 'c', 'a'].forEach((item, index) => cache.add(item, index));

        assert.equal(cache._cur_size, 3, 'Wrong number of cache entries');
        assert.equal(cache._head.key, 'a', 'Last item accessed is at head');
        assert.equal(cache._tail.key, 'b', 'LRU is at tail');

        cache.get('b');
        assert.equal(cache._head.key, 'b', 'Accessing another item updates head');

        cache.get('nothing');
        assert.equal(cache._head.key, 'b', 'Uncached values will not affect the LRU order');
    });

    it('stores metadata along with cache entries', function () {
        const cache = new LRUCache(3);

        const meta = {chr: '1', start: 1, end: 100};
        cache.add('something', 12, meta);

        assert.deepEqual(cache._head.metadata, meta);
    });
});
