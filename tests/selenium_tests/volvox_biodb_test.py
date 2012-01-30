from selenium import webdriver
from selenium.webdriver import ActionChains
from selenium.common.exceptions import NoSuchElementException
from selenium.webdriver.common.keys import Keys
from subprocess import check_call as call
import os
import time

def test_volvox():
    format_volvox()
    browser = webdriver.Firefox() # Get local session of firefox
    browser.get("file://%s/test_harness.html?data=sample_data/json/volvox" % os.getcwd() ) # Load page

    # check a good browser title
    assert "ctgA" in browser.title, "browser title is actually %s" % browser.title

    tabs = browser.find_elements_by_xpath( '//div[@class="browsingTab"]' )
    for t in tabs:
        t.click()
        time.sleep(1)
        t.click()
        time.sleep(0.5)

    assert_no_js_errors(browser)

    # do a test where we search for a certain gene using the search box
    search_f15(browser)

    assert_no_js_errors(browser)

    # test scrolling, make sure we get no js errors
    scroll(browser)

    browser.close()
    pass;

def scroll(browser):
    move_right_button = browser.find_element_by_id('moveRight')
    move_right_button.click()
    time.sleep(0.5)
    move_left_button = browser.find_element_by_id('moveLeft')
    move_left_button.click()
    # TODO: check the outcome of this
    time.sleep(0.5)

    assert_no_js_errors(browser)

    action_chains = ActionChains(browser)
    # scroll back and forth with the mouse
    action_chains \
       .move_to_element( move_right_button ) \
       .move_by_offset( 0, 300 ) \
       .click_and_hold( None ) \
       .move_by_offset( 300, 0 ) \
       .release( None ) \
       .move_by_offset( -100,100 ) \
       .click_and_hold( None ) \
       .move_by_offset( -300, 0 ) \
       .release( None ) \
       .perform()

    assert_no_js_errors(browser)

def assert_no_js_errors(browser):
    assert browser.find_element_by_xpath('/html/body').get_attribute('JSError') == None

def search_f15(browser):

    # check that a f15 feature label is not yet in the DOM
    yal024_xpath = "//div[@class='feature-label'][contains(.,'f15')]"
    try:
        browser.find_element_by_xpath( yal024_xpath )
        assert 0, ( "f15 is already in the DOM at load time, something is wrong" )
    except NoSuchElementException:
        pass

    # Find the query box and put f15 into it and hit enter
    qbox = browser.find_element_by_id("location")
    qbox.clear()
    qbox.send_keys( "f15" + Keys.RETURN )
    time.sleep( 0.2 )

    # test that f15 appeared in the DOM (TODO: check that it's
    # actually centered in the window), and that the protein-coding
    # genes track is now selected
    label = assert_element( browser, yal024_xpath )
    assert label.text == 'f15';

def assert_element( browser, xpathExpression ):
    try:
        el = browser.find_element_by_xpath( xpathExpression )
    except NoSuchElementException:
        assert 0, ( "can't find %s" % xpathExpression )
    return el

def format_volvox():
    os.environ['PATH'] = "bin/:" + os.environ['PATH']
    call( "rm -rf sample_data/json/volvox/", shell=True )
    call( "prepare-refseqs.pl --fasta sample_data/raw/volvox/volvox.fa --out sample_data/json/volvox/", shell=True )
    call( "biodb-to-json.pl --conf sample_data/raw/volvox.json --out sample_data/json/volvox/", shell=True )
    call( "generate-names.pl --dir sample_data/json/volvox/", shell=True )
