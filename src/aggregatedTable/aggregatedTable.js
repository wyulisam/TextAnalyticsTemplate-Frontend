/**
 * Created by IvanP on 04.07.2016.
 */

import HierarchyTable from './hierarchyTable.js';
import FixedHeader from './FixedHeader.js';

class AggregatedTable{
  /**
   * A class that unifies work with Aggregated tables. Enabling a fixed header, search functionality, sorting, hierarchy etc can be done here.
   * @param {HTMLTableElement} table - table on which the action is to be performed
   * @param {Object} hierarchy - config for {@link HierarchyTable}. See {@link HierarchyTable} docs for available object properties. If hierarchy.source is not defined, it will automatically receive value from `table`
   * @param {Object} fixedHeader - config for {@link FixedHeader}. See {@link FixedHeader} docs for available object properties. If hierarchy.source is not defined, it will automatically receive value from `table`
   * */
  constructor({table, hierarchy, fixedHeader}={}){
    this.hierarchy=null;
    if(hierarchy && typeof hierarchy == 'object'){
      // initialize hierarchy column to be parsed and presented as tree
      hierarchy.source = hierarchy.source||table;
      this.hierarchy = new HierarchyTable(hierarchy);
      this.data = this.hierarchy.data;
      //initialize buttons that will toggle between flat and tree view
      let buttonHost = this.hierarchy.source.querySelector(`thead>tr>td:nth-child(${this.hierarchy.column+1})`);
      this.addToggleButton(buttonHost,'hierarchy-tree',false,'Tree View');
      this.addToggleButton(buttonHost,'hierarchy-flat',true,'Flat View');
      if(this.hierarchy.search.enabled){
        this.addSearchBox(buttonHost);
      }
    }
    if(fixedHeader && typeof fixedHeader == 'object'){
      fixedHeader.source = fixedHeader.source||table;
      this.fixedHeader = new FixedHeader(fixedHeader);
      //initialize buttons that will toggle between flat and tree view in the original table
      let buttonHost = this.fixedHeader.clonedHeader.querySelector(`thead>tr>td:nth-child(${this.hierarchy.column+1})`);
      [].slice.call(buttonHost.children).forEach((item)=>{item.parentNode.removeChild(item)}); //clears hierarchy toggle buttons cloned from original header
      this.addToggleButton(buttonHost,'hierarchy-tree',false,'Tree View');
      this.addToggleButton(buttonHost,'hierarchy-flat',true,'Flat View');
      if(this.hierarchy.search.enabled){
        this.addSearchBox(buttonHost);
      }
    }
    this.source=table;
    this.init();

  }

  /**
   * Initializes the app
   * */
  init(){
    // for collapsable hierarchy we want to update cells in the fixed(floating) header.
    var _target;
    var resizeDebouncer = this.constructor.debounce(()=>this.fixedHeader.resizeFixed(),100);
    var scrollDebouncer = this.constructor.debounce(()=>this.scrollToElement(_target),50);
    ['collapsed','uncollapsed','tree-view','flat-view'].forEach((eventNameChunk)=>{
      this.source.addEventListener(`reportal-table-hierarchy-${eventNameChunk}`,(e)=>{
      resizeDebouncer();
      _target = e.target;
      scrollDebouncer();
      });
    });
    this.focusFollows();

  }

  /**
   * Allows focus to follow from a search field into floating header and back when header disappears.
   * */
  focusFollows(){
    if(this.fixedHeader){
      var inputs = [].slice.call(this.source.parentNode.querySelectorAll(`table>thead>tr>td:nth-child(${this.hierarchy.column+1}) input`));
      ['visible','hidden'].forEach(eventChunk=>{
        this.source.addEventListener(`reportal-fixed-header-${eventChunk}`,(e)=>{
          if(this.hierarchy.search.searching && document.activeElement && inputs.indexOf(document.activeElement)!=-1){
            let current = this.hierarchy.search.target;
            for(let i=0;i<inputs.length;i++ ){
              if(inputs[i]!=document.activeElement){
                inputs[i].focus();
                this.hierarchy.search.target=inputs[i];
                break;
              }
            }
          }
        })
      });
    }
  }

  /**
   * This function adds toggle buttons for hierarchy (to toggle the [flat-view/tree-view]{@link HierarchyTable#flat} mode) to the hierarchy column (here available as `this.hierarchy.column`).
   * This function is executed for both the original table and the cloned header.
   * @param {HTMLTableCellElement} host - reference to the cell which acts as a header for hierarchy column
   * @param {String} buttonClassChunk - the part of the icon-class name that follows the `.icon-`. Is used to reference the icon class, but also used for the button without the `.icon-` prefix
   * @param {Boolean} flat - Boolean to be set on [`hierarchy.flat`]{@link HierarchyTable#flat} when this button is clicked.
   * @param {String} [title] - the title that describes what the button does to be show on hover (is set to native attribute `title` on the button element)
   * */
  addToggleButton(host,buttonClassChunk,flat,title){
    let button = document.createElement('span'),
      buttonContainer = document.createElement('span');
    button.classList.add(`icon-${buttonClassChunk}`);
    buttonContainer.classList.add('btn', buttonClassChunk);
    buttonContainer.title=title;
    if(flat==this.hierarchy.flat){buttonContainer.classList.add('active');}
    buttonContainer.addEventListener('click',(e)=>{
      if(flat==this.hierarchy.flat){return;} else {
        this.hierarchy.flat = flat;
        // we want to get all hier. toggle buttons in both cloned header and the table itself
        let hierColumnButtons = this.hierarchy.source.parentNode.querySelectorAll(`table>thead>tr>td:nth-child(${this.hierarchy.column+1})>.btn`);
        if(hierColumnButtons){[].slice.call(hierColumnButtons).forEach((item)=>{
          //By default one button is already `.active`, we need just to swap the `.active` class on them
          !item.classList.contains('active')?item.classList.add('active'):item.classList.remove('active');
        })}
      }
      //this.scrollToElement(e.target);
    });
    buttonContainer.appendChild(button);
    host.appendChild(buttonContainer);
  }

  /**
   * Adds a search icon and a search box to the header of the hierarchy column (`host`)
   * @param {HTMLTableCellElement} host - header of the hierarchy column
   * */
  addSearchBox(host){
    let button = document.createElement('span'),
        buttonContainer = document.createElement('span'),
        clearButton = document.createElement('span'),
        searchfield = document.createElement('input');

    searchfield.type='text';
    button.classList.add('icon-search');
    clearButton.classList.add('icon-add', 'clear-button');
    buttonContainer.classList.add('btn', 'hierarchy-search');

    //listener to display search field on search-icon click
    button.addEventListener('click',e=>{
    if(!this.hierarchy.search.visible){this.hierarchy.search.visible = true;}
    e.target.parentNode.querySelector('input').focus();
  });

    //listener to display search field on search-icon click
    clearButton.addEventListener('click',e=>{
      this.clearSearch();
    });

    buttonContainer.title = searchfield.placeholder = 'Search categories...';

    let efficientSearch = this.search();
    //TODO: add cursor following the header (if a floating header appeared, cursor must focus there)
    searchfield.addEventListener('keyup',e=>{
      this.updateSearchTarget(e); //update search parameters
      efficientSearch();          // call search less frequently

    });


    searchfield.addEventListener('blur',e=>{
      if(e.target.value.length==0)this.clearSearch(); //update search parameters
  });



    buttonContainer.appendChild(button);
    buttonContainer.appendChild(searchfield);
    buttonContainer.appendChild(clearButton);
    host.appendChild(buttonContainer);

  }

  /**
   * Nulls search and redoes it, used in toggling between `flat` and `tree` views in hierarchy, necessary because the search is done on different name strings
   * */
  clearSearch(){
    this.hierarchy.search.target = null;
    this.hierarchy.search.query='';
    this.hierarchy.search.visible=false;
    this.hierarchy.search.searching=false;
    var inputs = this.hierarchy.source.parentNode.querySelectorAll(`table>thead>tr>td:nth-child(${this.hierarchy.column+1}) input`);
    if(inputs && inputs.length>1){inputs.forEach(input=>{input.value = '';})}
  }

  /**
   * Updates `search.target` && `search.query` in `hierarchy.search` to know which input triggered the search and update the `search.query` in the other
   * @param {Event} e - a debounced event triggered by input field when a person enters text
   * */
  updateSearchTarget(e){
    this.hierarchy.search.target = e.target;
    this.hierarchy.search.query = e.target.value;
    var inputs = this.hierarchy.source.parentNode.querySelectorAll(`table>thead>tr>td:nth-child(${this.hierarchy.column+1}) input`);
    if(inputs && inputs.length>1){inputs.forEach(input=>{if(input!=e.target){input.value = e.target.value;return;}})}
  }

  /**
   * Smooth-scrolls page so that the element that's been clicked stays ato the top of the table and compensates for scrolling header.
   * There is a flaw that the collapsed/uncollapsed event is triggered for all searching, so a debouncer is set in place, though it does scroll to the last expanded found element
   * @param {HTMLElement} el - element that triggered the event
   * */
  scrollToElement(el){
    let visible = window.pageYOffset>this.source.parentNode.offsetTop;
    var floatingHeader = visible?this.fixedHeader.clonedHeader.offsetHeight:0,
          offset = this.source.parentNode.offsetTop + el.offsetTop - floatingHeader;
          this.scrollTo(offset,200);

      window.setTimeout(()=>{
      if(visible!=window.pageYOffset>this.source.parentNode.offsetTop){
          this.scrollTo(this.source.parentNode.offsetTop + el.offsetTop - (window.pageYOffset>this.source.parentNode.offsetTop?this.fixedHeader.clonedHeader.offsetHeight:0),20)
      }
    },250);

  }

  scrollTo(to, duration) {
  var start = window.pageYOffset || document.documentElement.scrollTop,
    change = to - start,
    currentTime = 0,
    increment = 20;

  var animateScroll = function(){
    currentTime += increment;
    var val = easeInOutQuad(currentTime, start, change, duration);
    window.scrollTo(0,val);
    if(currentTime < duration) {
      setTimeout(animateScroll, increment);
    }
  };
  animateScroll();

  //t = current time
  //b = start value
  //c = change in value
  //d = duration
    function easeInOutQuad (t, b, c, d) {
      t /= d/2;
      if (t < 1) return c/2*t*t + b;
      t--;
      return -c/2 * (t*(t-2) - 1) + b;
    }
}


  /**
   * Wrapping function that debounces search, sets `search.searching` [(click for info)]{@link HierarchyTable#setupSearch} and calls `hierarchy.searchRowheaders` [(click for info)]{@link HierarchyTable#searchRowheaders}
   * @return {Function}
   * */
  search(){
    let hierarchy = this.hierarchy,
        settings = hierarchy.search,
        self=this;
    return this.constructor.debounce(function(){
      let value = settings.query;
      if(value.length>0){
        if(!settings.searching){settings.searching=true;}
        hierarchy.searchRowheaders(value);
      } else {
        settings.searching=false;
      }
    }, settings.timeout, settings.immediate);

  }

  /**
   * A debouncing function, used for cases when as `func` function needs to be called less often, after a certain `wait` timeout or `immediate`-ly
   * @param {Function} func - the function that needs to be executed at a lesser rate
   * @param {Number} [wait=300] - timeout after which the `func`tion executes
   * @param {Boolean} [immediate=false] - flag to be set when function needs to be executed immediately (overrides `wait` timeout)
   * @return {Function}
   * */
  static debounce (func, wait=300, immediate=false){
    var timeout;
    return ()=>{
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      var callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(context, args);
    };
  }


}

export default AggregatedTable;
