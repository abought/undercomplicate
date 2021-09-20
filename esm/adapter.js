import {LRUCache} from './lru_cache';
import {clone} from './util';

class BaseAdapter {
    constructor(config = {}) {
        this._config = config;
        const {
            // Cache control
            cache_enabled = true,
            cache_size = 3,
        } = config;
        this._enable_cache = cache_enabled;
        this._cache = new LRUCache(cache_size);
    }

    _buildRequestOptions(options, dependent_data) {
        // Perform any pre-processing required that may influence the request. Receives an array with the payloads
        //  for each request that preceded this one in the dependency chain
        // This method may optionally take dependent data into account
        return Object.assign({}, options);
    }

    _getCacheKey(options) {
        /* istanbul ignore next */
        if (this._enable_cache) {
            throw new Error('Method not implemented');
        }
        return null;
    }

    /**
     * Perform the act of data retrieval (eg from a URL, blob, or JSON entity)
     * @param options
     * @returns {Promise}
     * @private
     */
    _performRequest(options) {
        /* istanbul ignore next */
        throw new Error('Not implemented');
    }

    _normalizeResponse(response_text, options) {
        // Convert the response format into a list of objects, one per datapoint. Eg split lines of a text file, or parse a blob of json.
        return response_text;
    }

    /**
     * Perform custom client-side operations on the retrieved data. For example, add calculated fields or
     *  perform rapid client-side filtering on cached data
     * @param records
     * @param {Object} options
     * @returns {*}
     * @private
     */
    _annotateRecords(records, options) {
        return records;
    }

    /**
     * A hook to transform the response after all operations are done. For example, this can be used to prefix fields
     *  with a namespace unique to the request, like assoc.log_pvalue. (that way, annotations and validation can happen
     *  on the actual API payload, without having to guess what the fields were renamed to).
     * @param records
     * @param options
     * @private
     */
    _postProcessResponse(records, options) {
        return records;
    }

    getData(options = {}, ...dependent_data) {
        // Public facing method to define, perform, and process the request
        options = this._buildRequestOptions(options, ...dependent_data);

        // Then retrieval and parse steps: parse + normalize response, annotate
        const cache_key = this._getCacheKey(options);

        let result;
        if (this._enable_cache && this._cache.has(cache_key)) {
            result = this._cache.get(cache_key);
        } else {
            // Cache the promise (to avoid race conditions in conditional fetch). If anything (like `_getCacheKey`)
            //  sets a special option value called `_cache_meta`, this will be used to annotate the cache entry
            // For example, this can be used to decide whether zooming into a view could be satisfied by a cache entry,
            //  even if the actual cache key wasn't an exact match
            result = Promise.resolve(this._performRequest(options))
                // Note: we cache the normalized (parsed) response
                .then((text) => this._normalizeResponse(text, options));
            this._cache.add(cache_key, result, options._cache_meta);
            // We are caching a promise, which means we want to *un*cache a promise that rejects, eg a failed or interrupted request
            //  Otherwise, temporary failures couldn't be resolved by trying again in a moment
            result.catch((e) => this._cache.remove(cache_key));
        }

        return result
            // Return a deep clone of the data, so that there are no shared mutable references to a parsed object in cache
            .then((data) => clone(data))
            .then((records) => this._annotateRecords(records, options))
            .then((records) => this._postProcessResponse(records, options));
    }
}


/**
 * Fetch data over the web
 */
class BaseUrlAdapter extends BaseAdapter {
    constructor(config = {}) {
        super(config);
        this._url = config.url;
    }


    // Default cache key is the URL for the request.
    _getCacheKey(options) {
        return this._getURL(options);
    }

    _getURL(options) {
        return this._url;
    }

    _performRequest(options) {
        const url = this._getURL(options);
        // Many resources will modify the URL to add query or segment parameters. Base method provides option validation.
        //  (not validating in constructor allows URL adapter to be used as more generic parent class)
        if (!this._url) {
            throw new Error('Web based resources must specify a resource URL as option "url"');
        }
        return fetch(url).then((response) => {
            if (!response.ok) {
                throw new Error(response.statusText);
            }
            // In most cases, we store the response as text so that the copy in cache is clean (no mutable references)
            return response.text();
        });
    }

    _normalizeResponse(response_text, options) {
        if (typeof response_text === 'string') {
            return JSON.parse(response_text);
        }
        // Some custom usages will return an object directly; return a copy of the object
        return response_text;
    }
}

export { BaseAdapter, BaseUrlAdapter };
