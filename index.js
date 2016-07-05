var fs = require( 'fs' );
var pa = require( 'path' );
var Q  = undefined;

fs.mkdirParent = function (dirPath, mode, callback) {
	//Call the standard fs.mkdir
	fs.mkdir( dirPath, mode, function (error) {
		//When it fail in this way, do the custom steps
		if (error && (error.errno === 34 || error.code === 'ENOENT')) {
			//Create all the parents recursively
			fs.mkdirParent( pa.dirname( dirPath ), mode, callback );
			//And then the directory
			fs.mkdirParent( dirPath, mode, callback );
		}
		//Manually run the callback since we used our own callback to do all these
		callback && callback( error );
	} );
};

function getQ() {

	if (Q == undefined) {
		try {
			Q = require( 'q' );
		}
		catch (e) {
			console.log( "Q Module must be includes!" );
		}
	}

	return Q;
}

var isifs = function () {

	var p     = isifs.prototype;
	var scope = this;
	var Q     = undefined;

	p.existsQ = function (path) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to removeQ' );

		var deferred = Q.defer();

		fs.exists( path, function (exists) {
			deferred.resolve( exists )
		} );

		return deferred.promise;
	};

	/**
	 *
	 * @param path
	 * @param keepFolder
	 */
	p.removeSync = function (path, keepFolder) {
		keepFolder = keepFolder === true;

		if (fs.existsSync( path )) {
			fs.readdirSync( path ).forEach( function (file, index) {
				var curPath = path + "/" + file;
				if (fs.lstatSync( curPath ).isDirectory()) { // recurse
					scope.removeSync( curPath );
				} else { // delete file
					fs.unlinkSync( curPath );
				}
			} );

			if (!keepFolder)
				fs.rmdirSync( path );
		}
	};

	/**
	 *
	 * @param path
	 * @returns {*|promise}
	 */
	p.removeQ = function (path) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to removeQ' );

		var fs_unlink = Q.denodeify( fs.unlink );
		var deferred  = Q.defer();

		fs.stat( path, function (err, obj) {
			if (err) return deferred.reject( err );

			var isDir = obj.isDirectory();

			if (!isDir) {
				fs_unlink( path )
						.then( function () {
							deferred.resolve( true );
						} )
						.catch( function (err) {
							deferred.reject( err );
						} );
			}
		} );

		return deferred.promise;
	};

	/**
	 *
	 * @param path
	 * @returns {*|promise}
	 */
	p.createFolderQ = function (path) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to removeQ' );

		var deferred = Q.defer();

		fs.exists( path, function (exists) {
			if (exists)
				return deferred.resolve( false );

			fs.mkdirParent( path, undefined, function (err, obj) {
				if (err) return deferred.reject( err );

				deferred.resolve( true );
			} );
		} );

		return deferred.promise;
	};

	p.getPathParts = function (filename) {
		filename = filename.replace( new RegExp( "/", "g" ), '\\' );
		return filename.split( '\\' );
	};

	p.uniqueFilenameSync = function (filename) {
		var tempFilename = filename;

		var i = 1;

		while (fs.existsSync( tempFilename )) {
			tempFilename = scope.appendToFilename( filename, '_' + i );
			++i;
		}

		return tempFilename;
	};

	p.moveQ = function (oldPath, newPath) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to moveQ: Module "Q" is missing.' );

		var deferred = Q.defer();

		function copy() {

			var readStream  = fs.createReadStream( oldPath );
			var writeStream = fs.createWriteStream( newPath );
			readStream.on( 'error', function (err) {
				return deferred.reject( err );
			} );
			writeStream.on( 'error', function (err) {
				return deferred.reject( err );
			} );
			readStream.on( 'close', function () {
				fs.unlink( oldPath, function (err, obj) {
					if (err) return deferred.reject( err );

					deferred.resolve( newPath );
				} );
			} );
			readStream.pipe( writeStream );
		}

		scope.createFolderQ( pa.dirname( newPath ) )
				.finally( function () {
					fs.rename( oldPath, newPath, function (err) {
						if (err) {
							if (err.code === 'EXDEV') {
								return copy();
							} else {
								return deferred.reject( err );
							}
						}
						deferred.resolve( newPath );
					} );
				} );

		return deferred.promise;
	};

	p.appendToFilename = function (filePath, value) {
		var ext      = pa.extname( filePath );
		var position = filePath.length - ext.length;

		return [filePath.slice( 0, position ), value, filePath.slice( position )].join( '' );
	};

	p.cwd = p.currentDir = p.baseDir = function () {
		return process.cwd();
	};

	p.getJsonContent = function (jsonPath) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to moveQ: Module "Q" is missing.' );

		var deferred = Q.defer();

		fs.exists( jsonPath, function (jsonExists) {
			if (!jsonExists) return deferred.reject();

			fs.readFile( jsonPath, function (err, data) {
				if (err) return deferred.reject( err );

				try {
					var jsonObject = JSON.parse( data );
					deferred.resolve( jsonObject );
				} catch (ex) {
					console.log( 'Failed to load file: ', jsonPath );
					return deferred.reject( ex );
				}

			} );
		} );

		return deferred.promise;
	};

	p.saveJsonContentToFile = function (jsonPath, jsonContent) {
		Q = getQ();
		if (!Q) throw Error( 'Failed to moveQ: Module "Q" is missing.' );

		var writeFile = Q.denodeify( fs.writeFile );

		return writeFile( jsonPath, JSON.stringify( jsonContent, null, 4 ) )
	}
};

module.exports = new isifs();