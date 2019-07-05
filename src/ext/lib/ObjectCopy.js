import Debug from '../conf/Debug';

class ObjectCopy {
  static addNew(existing, target){
    
    // clone target
    var out = JSON.parse(JSON.stringify(target));

    if(! existing) {
      if(Debug.debug) {
        console.log("[ObjectCopy::addNew] There's no existing value. Returning target value.");
      }

      return out;
    }

    for(var k in out) {
      // if current key exist, replace it with existing value. Take no action otherwise.
      if(existing[k]) {

        // Types and constructors of objects must match. If they don't, we always use the new value.
        if(typeof out[k] === typeof existing[k] && out[k].constructor === existing[k].constructor) {
          
          // objects are special, we need to check them recursively.
          if(out[k] && typeof out[k] === 'object' && out[k].constructor === Object ) {
            if(Debug.debug && Debug.settings) {
              console.log("[ObjectCopy::addNew] current key contains an object. Recursing!")
            }

            out[k] = this.addNew(existing[k], out[k]);
          } else {
            out[k] = existing[k];       
          }
        }
      }
    }

    // add the values that would otherwise be deleted back to our object. (We need that so user-defined
    // sites don't get forgotten)
    for(var k in existing) {
      if (! out[k]) {
        out[k] = existing[k];
      }
    }

    return out;
  }

  static overwrite(existing, target){
    for(var k in target) {
      // if current key exist, replace it with existing value. Take no action otherwise.
      if (existing[k]) {

        // Types and constructors of objects must match. If they don't, we always use the new value.
        if (typeof target[k] === typeof existing[k] && target[k].constructor === existing[k].constructor) {
          
          // objects are special, we need to check them recursively.
          if(existing[k] && typeof existing[k] === 'object' && existing[k].constructor === Object ) {
            if(Debug.debug && Debug.settings) {
              console.log("[ObjectCopy::addNew] current key contains an object. Recursing!")
            }

            existing[k] = this.overwrite(existing[k], target[k]);
          } else {
            existing[k] = target[k];       
          }
        } else {
          existing[k] = target[k];
        }
      }
    }
    return existing;
  }

  static pruneUnused(existing, target, ignoreKeys) {
    // TODO: implement at some other date
    // existing: object that we have.
    // target: object that we want
    // ignoreKeys: if key is an object, we don't recursively call this function on that key
  }
}

export default ObjectCopy;