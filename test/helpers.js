const assert = require('assert');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const url = require('url');

module.exports = {
	runTest: function(test, cb) {
		assert.notStrictEqual(typeof cb, 'function', 'Callback is not allowed with runTest');
		return this.runFunctionTest(test);
	},
	runFunctionTest: function(test, cb) {
		assert.notStrictEqual(typeof cb, 'function', 'Callback is not allowed with runFunctionTest');
		let result;
		let thrownError;
		let args = typeof test.args === 'function' ? test.args.call(test) : test.args;
		if (typeof args === 'object') {
			args = Object.values(args);
		}
		try { result = test.fn.apply(undefined, args); } catch (error) {
			thrownError = error;
		}
		if (typeof thrownError !== 'undefined') {
			// An error was thrown.
			if (test.expectThrownError) {
				// Check if the thrown error message matches what as expected.
				assert.strictEqual(thrownError.message, test.expectThrownError);
			} else {
				// Rethrow because an error wasn't expected.
				throw thrownError;
			}
		} else if (test.expectThrownError) {
			throw new Error(`Expected error to be thrown: '${test.expectThrownError}'`);
		}
		if (typeof test.expected !== 'undefined') {
			if (typeof test.expected === 'function') {
				// Return here because expected can return a promise.
				return test.expected.call(this, result);
			} else {
				assert.deepStrictEqual(result, test.expected);
			}
		}
		return result;
	},
	request: function(method, requestOptions) {
		return new Promise((resolve, reject) => {
			try {
				const parsedUrl = url.parse(requestOptions.url);
				let options = {
					method: method.toUpperCase(),
					hostname: parsedUrl.hostname,
					port: parsedUrl.port,
					path: parsedUrl.path,
					ca: requestOptions.ca || null,
					headers: requestOptions.headers || {},
				};
				options.headers = options.headers || {};
				if (requestOptions.qs) {
					options.path += '?' + querystring.stringify(requestOptions.qs);
				}
				let postData;
				if (requestOptions.form) {
					options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
					postData = querystring.stringify(requestOptions.form);
				} else if (requestOptions.body && requestOptions.json) {
					options.headers['Content-Type'] = 'application/json';
					postData = JSON.stringify(requestOptions.body);
				}
				if (postData) {
					options.headers['Content-Length'] = Buffer.byteLength(postData);
				}
				const request = parsedUrl.protocol === 'https:' ? https.request : http.request;
				const req = request(options, function(response) {
					let body = '';
					response.on('data', function(buffer) {
						body += buffer.toString();
					});
					response.on('end', function() {
						if (requestOptions.json) {
							try { body = JSON.parse(body); } catch (error) {
								return reject(error);
							}
						}
						resolve({ response, body });
					});
				});
				if (postData) {
					req.write(postData);
				}
				req.once('error', reject);
				req.end();
			} catch (error) {
				return reject(error);
			}
		});
	},
};
